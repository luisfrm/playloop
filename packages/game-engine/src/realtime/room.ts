/**
 * Pure room state machine for turn-based board play.
 *
 * The Durable Object owns the wiring (WebSockets, storage, alarms); this module
 * owns the rules. Keeping the rules pure means the room can be tested without
 * `workerd`, and the DO stays a thin adapter.
 *
 * One match, one shared board, strict turns in seat order:
 *
 * - The board arrives frozen, with its answers sealed inside the DO. The
 *   public state only ever shows what was already resolved on it.
 * - Every round each standing member picks exactly one cell on their turn.
 *   A miss costs a life; a re-pick is impossible because resolved cells lock.
 * - Starting a round past the first pays one point to everyone still standing,
 *   so being eliminated in round R is worth R-1. Completing the board pays the
 *   room bonus to every winner.
 * - The match ends when a new round would start with a single member standing
 *   (they win), with none (no bonus), or the moment every target is marked
 *   (everyone standing wins). A finished room can start a fresh match on a new
 *   board without losing its members or its accumulated totals.
 */

export const ROOM_INACTIVITY_TTL_MS = 15 * 60 * 1000
export const ROOM_FINISHED_TTL_MS = 5 * 60 * 1000
export const MAX_ROOM_MEMBERS = 8
/** One point per extra round started standing: elimination in round R pays R-1. */
export const ROOM_SURVIVAL_POINTS = 1
/** Paid to every winner when the board is completed or taken outright. */
export const ROOM_COMPLETION_BONUS = 2

export type RoomPhase = "lobby" | "playing" | "finished"

export type RoomMember = {
  playerId: string
  name: string
  /** This match's score. */
  score: number
  /** Accumulated across every match played in this room. */
  totalScore: number
  lives: number
  connected: boolean
}

/** One match's board. The answers never leave the Durable Object. */
export type RoomBoard = {
  /** Display order, frozen when the room is created. */
  optionIds: string[]
  /** The cells that must be found. Sealed server-side. */
  correctIds: string[]
  /** Correct picks so far. Public: progress is the game. */
  foundIds: string[]
  /** Revealed misses. Public and locked for everyone. */
  falseIds: string[]
}

export type RoomTurn = {
  turnMemberId: string
  roundNumber: number
  startedAt: number
  expiresAt: number
}

export type RoomState = {
  code: string
  gameInstanceId: string
  gameTypeKey: string
  /** Lets the client link back to the game it is playing. */
  gameSlug: string
  hostId: string
  phase: RoomPhase
  members: RoomMember[]
  board: RoomBoard
  /** optionId -> label, shared by every match of this instance. */
  optionLabels: Record<string, string>
  /** optionId -> media url, shared like the labels. */
  optionMedia: Record<string, string>
  turn: RoomTurn | null
  /** The round being played. Round one pays nothing. */
  roundNumber: number
  /** Per-turn budget in milliseconds. */
  turnDurationMs: number
  /** Lives every member starts each match with. */
  initialLives: number
  /** How many matches this room has played. */
  matchNumber: number
  lastActivityAt: number
  finishedAt: number | null
}

export type RoomCommand =
  | { ok: true; state: RoomState }
  | { ok: false; state: RoomState; reason: RoomErrorReason }

export type RoomErrorReason =
  | "no_room"
  | "room_full"
  | "already_joined"
  | "not_a_member"
  | "not_the_host"
  | "wrong_phase"
  | "not_your_turn"
  | "unknown_option"
  | "already_resolved"

function touch(state: RoomState, now: number): RoomState {
  return { ...state, lastActivityAt: now }
}

function memberOf(state: RoomState, playerId: string): RoomMember | undefined {
  return state.members.find((member) => member.playerId === playerId)
}

function standing(state: RoomState): RoomMember[] {
  return state.members.filter((member) => member.lives > 0)
}

function freshTurn(
  state: RoomState,
  turnMemberId: string,
  roundNumber: number,
  now: number
): RoomTurn {
  return {
    turnMemberId,
    roundNumber,
    startedAt: now,
    expiresAt: now + state.turnDurationMs,
  }
}

function emptyBoard(board: RoomBoard): RoomBoard {
  return { ...board, foundIds: [], falseIds: [] }
}

export function createRoom(input: {
  code: string
  gameInstanceId: string
  gameTypeKey: string
  gameSlug: string
  hostId: string
  hostName: string
  board: RoomBoard
  optionLabels: Record<string, string>
  optionMedia: Record<string, string>
  turnDurationMs: number
  initialLives: number
  now: number
}): RoomState {
  return {
    code: input.code,
    gameInstanceId: input.gameInstanceId,
    gameTypeKey: input.gameTypeKey,
    gameSlug: input.gameSlug,
    hostId: input.hostId,
    phase: "lobby",
    members: [
      {
        playerId: input.hostId,
        name: input.hostName,
        score: 0,
        totalScore: 0,
        lives: input.initialLives,
        connected: true,
      },
    ],
    board: emptyBoard(input.board),
    optionLabels: input.optionLabels,
    optionMedia: input.optionMedia,
    turn: null,
    roundNumber: 0,
    turnDurationMs: input.turnDurationMs,
    initialLives: input.initialLives,
    matchNumber: 0,
    lastActivityAt: input.now,
    finishedAt: null,
  }
}

export function joinRoom(
  state: RoomState,
  member: { playerId: string; name: string },
  now: number
): RoomCommand {
  if (state.members.length >= MAX_ROOM_MEMBERS) {
    return { ok: false, state, reason: "room_full" }
  }
  if (state.members.some((current) => current.playerId === member.playerId)) {
    return { ok: false, state, reason: "already_joined" }
  }
  if (state.phase !== "lobby") {
    return { ok: false, state, reason: "wrong_phase" }
  }

  return {
    ok: true,
    state: touch(
      {
        ...state,
        members: [
          ...state.members,
          {
            ...member,
            score: 0,
            totalScore: 0,
            lives: state.initialLives,
            connected: true,
          },
        ],
      },
      now
    ),
  }
}

export function markDisconnected(
  state: RoomState,
  playerId: string,
  now: number
): RoomState {
  return touch(
    {
      ...state,
      members: state.members.map((member) =>
        member.playerId === playerId ? { ...member, connected: false } : member
      ),
    },
    now
  )
}

export function leaveRoom(
  state: RoomState,
  playerId: string,
  now: number
): RoomState {
  const members = state.members.filter((member) => member.playerId !== playerId)
  const hostId =
    state.hostId === playerId ? (members[0]?.playerId ?? "") : state.hostId
  if (members.length === 0) {
    return touch(
      {
        ...state,
        members,
        hostId,
        phase: "finished",
        turn: null,
        finishedAt: now,
      },
      now
    )
  }

  let next: RoomState = touch({ ...state, members, hostId }, now)
  if (next.phase !== "playing" || !next.turn) return next

  // A departure must never stall the table: the turn moves on, and a table
  // left with a single member standing ends right away.
  const standingNow = standing(next)
  if (standingNow.length === 0) return finishMatch(next, [], now)
  if (standingNow.length === 1) {
    const winner = standingNow[0]
    if (winner) return finishMatch(next, [winner.playerId], now)
  }
  if (next.turn.turnMemberId === playerId) {
    // The seat after the leaver keeps the round going, wrapping around.
    const oldSeats = state.members.map((member) => member.playerId)
    const orig = oldSeats.indexOf(playerId)
    const start = orig + 1 >= oldSeats.length ? 0 : orig
    const following = firstStandingFrom(next.members, start)
    if (following) {
      next = {
        ...next,
        turn: freshTurn(next, following.playerId, next.roundNumber, now),
      }
    }
  }
  return next
}

/** First standing member from `start`, wrapping around the seats. */
function firstStandingFrom(
  members: RoomMember[],
  start: number
): RoomMember | null {
  for (let step = 0; step < members.length; step++) {
    const candidate = members[(start + step) % members.length]
    if (candidate && candidate.lives > 0) return candidate
  }
  return null
}

/**
 * The seat after `fromPlayerId`, skipping the eliminated. Seats never
 * reorder: the order is fixed and the turn rotates through it.
 */
function nextStandingAfter(
  state: RoomState,
  fromPlayerId: string
): RoomMember | null {
  const seats = state.members.map((member) => member.playerId)
  const from = seats.indexOf(fromPlayerId)
  if (from < 0 || seats.length === 0) return null
  return firstStandingFrom(state.members, (from + 1) % seats.length)
}

/**
 * Closes the match: winners take the bonus, everyone banks their match score
 * into the room total.
 */
function finishMatch(
  state: RoomState,
  winnerIds: string[],
  now: number
): RoomState {
  const members = state.members.map((member) => {
    const score =
      member.score +
      (winnerIds.includes(member.playerId) ? ROOM_COMPLETION_BONUS : 0)
    return { ...member, score, totalScore: member.totalScore + score }
  })
  return touch(
    { ...state, members, phase: "finished", turn: null, finishedAt: now },
    now
  )
}

/** Only the host can start, and only once per match. */
export function startRoom(
  state: RoomState,
  playerId: string,
  now: number
): RoomCommand {
  if (state.phase !== "lobby") {
    return { ok: false, state, reason: "wrong_phase" }
  }
  if (playerId !== state.hostId) {
    return { ok: false, state, reason: "not_the_host" }
  }
  const first = state.members[0]
  if (!first) return { ok: false, state, reason: "not_a_member" }

  const matchNumber = state.matchNumber + 1
  const starter =
    state.members[(matchNumber - 1) % state.members.length] ?? first
  const roundNumber = 1

  return {
    ok: true,
    state: touch(
      {
        ...state,
        phase: "playing",
        board: emptyBoard(state.board),
        members: state.members.map((member) => ({
          ...member,
          score: 0,
          lives: state.initialLives,
        })),
        roundNumber,
        matchNumber,
        turn: freshTurn(state, starter.playerId, roundNumber, now),
      },
      now
    ),
  }
}

/**
 * Starts a fresh match on a new board inside the same room. Members and their
 * accumulated totals stay; per-match scores, lives and the board reset.
 */
export function restartRoom(
  state: RoomState,
  playerId: string,
  input: {
    board: RoomBoard
    optionLabels: Record<string, string>
    optionMedia: Record<string, string>
  },
  now: number
): RoomCommand {
  if (state.phase !== "finished") {
    return { ok: false, state, reason: "wrong_phase" }
  }
  if (playerId !== state.hostId) {
    return { ok: false, state, reason: "not_the_host" }
  }
  if (state.members.length === 0) {
    return { ok: false, state, reason: "not_a_member" }
  }

  const matchNumber = state.matchNumber + 1
  const starter =
    state.members[(matchNumber - 1) % state.members.length] ?? state.members[0]
  if (!starter) return { ok: false, state, reason: "not_a_member" }
  const roundNumber = 1

  return {
    ok: true,
    state: touch(
      {
        ...state,
        phase: "playing",
        board: emptyBoard(input.board),
        optionLabels: input.optionLabels,
        optionMedia: input.optionMedia,
        members: state.members.map((member) => ({
          ...member,
          score: 0,
          lives: state.initialLives,
        })),
        roundNumber,
        matchNumber,
        finishedAt: null,
        turn: freshTurn(state, starter.playerId, roundNumber, now),
      },
      now
    ),
  }
}

function boardCompleted(board: RoomBoard): boolean {
  return (
    board.correctIds.length > 0 &&
    board.correctIds.every((id) => board.foundIds.includes(id))
  )
}

/**
 * Moves the turn forward, opening a new round when the table wraps around.
 * Opening a round past the first pays survival points; a table left with a
 * single member standing ends with them as the winner.
 */
function passTurn(
  state: RoomState,
  fromPlayerId: string,
  now: number
): RoomState {
  const seats = state.members.map((member) => member.playerId)
  const from = seats.indexOf(fromPlayerId)
  const next = nextStandingAfter(state, fromPlayerId)
  if (!next) return finishMatch(state, [], now)

  const nextIndex = seats.indexOf(next.playerId)
  if (nextIndex > from) {
    return touch(
      {
        ...state,
        turn: freshTurn(state, next.playerId, state.roundNumber, now),
      },
      now
    )
  }

  const roundNumber = state.roundNumber + 1
  const withSurvival: RoomState = {
    ...state,
    roundNumber,
    members: state.members.map((member) =>
      member.lives > 0
        ? { ...member, score: member.score + ROOM_SURVIVAL_POINTS }
        : member
    ),
  }
  const standingNow = standing(withSurvival)
  if (standingNow.length === 0) return finishMatch(withSurvival, [], now)
  if (standingNow.length === 1) {
    const winner = standingNow[0]
    if (winner) return finishMatch(withSurvival, [winner.playerId], now)
  }
  return touch(
    {
      ...withSurvival,
      turn: freshTurn(withSurvival, next.playerId, roundNumber, now),
    },
    now
  )
}

/**
 * The single place a room score can change. Only the turn holder's pick
 * counts; whether it held is decided here, against the sealed board.
 */
export function submitRoomAnswer(
  state: RoomState,
  playerId: string,
  optionId: string,
  now: number
): RoomCommand {
  const turn = state.turn
  if (state.phase !== "playing" || !turn) {
    return { ok: false, state, reason: "wrong_phase" }
  }
  const member = memberOf(state, playerId)
  if (!member) {
    return { ok: false, state, reason: "not_a_member" }
  }
  if (turn.turnMemberId !== playerId || member.lives <= 0) {
    return { ok: false, state, reason: "not_your_turn" }
  }
  if (!state.board.optionIds.includes(optionId)) {
    return { ok: false, state, reason: "unknown_option" }
  }
  if (
    state.board.foundIds.includes(optionId) ||
    state.board.falseIds.includes(optionId)
  ) {
    return { ok: false, state, reason: "already_resolved" }
  }

  const correct = state.board.correctIds.includes(optionId)
  const board: RoomBoard = correct
    ? { ...state.board, foundIds: [...state.board.foundIds, optionId] }
    : { ...state.board, falseIds: [...state.board.falseIds, optionId] }
  const lives = correct ? member.lives : member.lives - 1
  const picked: RoomState = touch(
    {
      ...state,
      board,
      members: state.members.map((current) =>
        current.playerId === playerId ? { ...current, lives } : current
      ),
    },
    now
  )

  if (boardCompleted(picked.board)) {
    return {
      ok: true,
      state: finishMatch(
        picked,
        standing(picked).map((winner) => winner.playerId),
        now
      ),
    }
  }
  if (standing(picked).length === 0) {
    return { ok: true, state: finishMatch(picked, [], now) }
  }
  return { ok: true, state: passTurn(picked, playerId, now) }
}

/**
 * The turn clock fired: the holder loses a life for stalling and the table
 * moves on. Nothing is revealed.
 */
export function expireTurn(state: RoomState, now: number): RoomCommand {
  const turn = state.turn
  if (state.phase !== "playing" || !turn) {
    return { ok: false, state, reason: "wrong_phase" }
  }
  const member = memberOf(state, turn.turnMemberId)
  if (!member) {
    return { ok: false, state, reason: "not_a_member" }
  }

  const stalled: RoomState = touch(
    {
      ...state,
      members: state.members.map((current) =>
        current.playerId === member.playerId
          ? { ...current, lives: Math.max(0, current.lives - 1) }
          : current
      ),
    },
    now
  )

  if (standing(stalled).length === 0) {
    return { ok: true, state: finishMatch(stalled, [], now) }
  }
  return { ok: true, state: passTurn(stalled, member.playerId, now) }
}

export function isTurnExpired(state: RoomState, now: number): boolean {
  return state.turn !== null && now >= state.turn.expiresAt
}

export function finishRoom(state: RoomState, now: number): RoomState {
  return touch(
    { ...state, phase: "finished", turn: null, finishedAt: now },
    now
  )
}

export function ranking(state: RoomState): RoomMember[] {
  return [...state.members].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name)
  )
}

/**
 * The next alarm deadline. Every action reschedules it, so an abandoned room is
 * destroyed and its code released — no manual cleanup job.
 */
export function alarmAt(state: RoomState, now: number): number {
  if (state.phase === "finished") {
    return (state.finishedAt ?? now) + ROOM_FINISHED_TTL_MS
  }
  if (state.phase === "playing" && state.turn) {
    return Math.min(
      state.turn.expiresAt,
      state.lastActivityAt + ROOM_INACTIVITY_TTL_MS
    )
  }
  return state.lastActivityAt + ROOM_INACTIVITY_TTL_MS
}

export function shouldDestroy(state: RoomState, now: number): boolean {
  if (state.phase === "finished") {
    return (
      now >= (state.finishedAt ?? state.lastActivityAt) + ROOM_FINISHED_TTL_MS
    )
  }
  return now >= state.lastActivityAt + ROOM_INACTIVITY_TTL_MS
}

/** What a member is allowed to see. The answers never cross the wire. */
export type RoomPublicState = {
  code: string
  gameSlug: string
  phase: RoomPhase
  hostId: string
  roundNumber: number
  turnDurationMs: number
  matchNumber: number
  members: {
    playerId: string
    name: string
    score: number
    totalScore: number
    lives: number
    connected: boolean
  }[]
  board: {
    options: {
      id: string
      label: string
      mediaUrl: string
      resolved: "true" | "false" | null
    }[]
    found: number
    total: number
  }
  turn: {
    turnMemberId: string
    roundNumber: number
    startedAt: number
    expiresAt: number
  } | null
}

export function publicRoomState(state: RoomState): RoomPublicState {
  return {
    code: state.code,
    gameSlug: state.gameSlug,
    phase: state.phase,
    hostId: state.hostId,
    roundNumber: state.roundNumber,
    turnDurationMs: state.turnDurationMs,
    matchNumber: state.matchNumber,
    members: state.members.map((member) => ({ ...member })),
    board: {
      options: state.board.optionIds.map((id) => ({
        id,
        label: state.optionLabels[id] ?? "",
        mediaUrl: state.optionMedia[id] ?? "",
        resolved: state.board.foundIds.includes(id)
          ? "true"
          : state.board.falseIds.includes(id)
            ? "false"
            : null,
      })),
      found: state.board.foundIds.length,
      total: state.board.correctIds.length,
    },
    turn: state.turn ? { ...state.turn } : null,
  }
}
