/**
 * Pure room state machine for cooperative play.
 *
 * The Durable Object owns the wiring (WebSockets, storage, alarms); this module
 * owns the rules. Keeping the rules pure means the room can be tested without
 * `workerd`, and the DO stays a thin adapter.
 *
 * The room is handed a queue of ready-made rounds instead of reaching for
 * content itself. That keeps it game-type agnostic: whatever built the rounds
 * decided what a round looks like, and the room only knows that one of the
 * options is the answer.
 */

import { POINTS_PER_CORRECT } from "../play/session.js"

export const ROOM_INACTIVITY_TTL_MS = 15 * 60 * 1000
export const ROOM_FINISHED_TTL_MS = 5 * 60 * 1000
export const MAX_ROOM_MEMBERS = 8

export type RoomPhase = "lobby" | "playing" | "finished"

export type RoomMember = {
  playerId: string
  name: string
  score: number
  connected: boolean
}

/** What one round shows the room. */
export type RoomRound = {
  prompt: { mediaUrl: string; caption?: string }
  optionIds: string[]
  /** The correct option. Never leaves the Durable Object. */
  answerOptionId: string
}

export type RoomQuestion = RoomRound & {
  startedAt: number
  expiresAt: number
  /** Player ids that already answered this question. */
  answeredBy: string[]
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
  /** The queue the room walks through, in order. */
  rounds: RoomRound[]
  /** How many rounds have been served so far. */
  cursor: number
  /** optionId -> label, shared by every round of this instance. */
  optionLabels: Record<string, string>
  question: RoomQuestion | null
  questionCount: number
  questionDurationMs: number
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
  | "already_answered"
  | "unknown_option"
  | "exhausted"

function touch(state: RoomState, now: number): RoomState {
  return { ...state, lastActivityAt: now }
}

function withQuestion(
  state: RoomState,
  round: RoomRound,
  now: number
): RoomState {
  return {
    ...state,
    question: {
      ...round,
      startedAt: now,
      expiresAt: now + state.questionDurationMs,
      answeredBy: [],
    },
  }
}

export function createRoom(input: {
  code: string
  gameInstanceId: string
  gameTypeKey: string
  gameSlug: string
  hostId: string
  hostName: string
  rounds: RoomRound[]
  optionLabels: Record<string, string>
  questionDurationMs: number
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
        connected: true,
      },
    ],
    rounds: input.rounds,
    cursor: 0,
    optionLabels: input.optionLabels,
    question: null,
    questionCount: 0,
    questionDurationMs: input.questionDurationMs,
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
        members: [...state.members, { ...member, score: 0, connected: true }],
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
  const phase = members.length === 0 ? "finished" : state.phase

  return touch(
    {
      ...state,
      members,
      hostId,
      phase,
      finishedAt: phase === "finished" ? now : null,
    },
    now
  )
}

/** Only the host can start, and only once. */
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
  const first = state.rounds[0]
  if (!first) return { ok: false, state, reason: "exhausted" }

  return {
    ok: true,
    state: touch(
      {
        ...withQuestion(state, first, now),
        phase: "playing",
        cursor: 1,
        questionCount: state.questionCount + 1,
      },
      now
    ),
  }
}

/**
 * Serves the next round. Returns `exhausted` when the queue is empty, which is
 * the caller's signal to finish the room.
 */
export function advanceRoom(state: RoomState, now: number): RoomCommand {
  if (state.phase !== "playing") {
    return { ok: false, state, reason: "wrong_phase" }
  }
  const round = state.rounds[state.cursor]
  if (!round) return { ok: false, state, reason: "exhausted" }

  return {
    ok: true,
    state: touch(
      {
        ...withQuestion(state, round, now),
        cursor: state.cursor + 1,
        questionCount: state.questionCount + 1,
      },
      now
    ),
  }
}

/**
 * The single place a room score can change. The option id is the only thing the
 * client sends; whether it was right is decided here, against the round's own
 * answer.
 */
export function submitRoomAnswer(
  state: RoomState,
  playerId: string,
  optionId: string,
  now: number
): RoomCommand {
  const question = state.question
  if (state.phase !== "playing" || !question) {
    return { ok: false, state, reason: "wrong_phase" }
  }
  if (!state.members.some((member) => member.playerId === playerId)) {
    return { ok: false, state, reason: "not_a_member" }
  }
  if (question.answeredBy.includes(playerId)) {
    return { ok: false, state, reason: "already_answered" }
  }
  if (!question.optionIds.includes(optionId)) {
    return { ok: false, state, reason: "unknown_option" }
  }

  const points = optionId === question.answerOptionId ? POINTS_PER_CORRECT : 0

  return {
    ok: true,
    state: touch(
      {
        ...state,
        members: state.members.map((member) =>
          member.playerId === playerId
            ? { ...member, score: member.score + points }
            : member
        ),
        question: {
          ...question,
          answeredBy: [...question.answeredBy, playerId],
        },
      },
      now
    ),
  }
}

export function isQuestionExpired(state: RoomState, now: number): boolean {
  return state.question !== null && now >= state.question.expiresAt
}

/** Everyone still connected answered: the room can move on immediately. */
export function everyoneAnswered(state: RoomState): boolean {
  const question = state.question
  if (!question) return false

  const connected = state.members.filter((member) => member.connected)
  return (
    connected.length > 0 &&
    connected.every((member) => question.answeredBy.includes(member.playerId))
  )
}

export function finishRoom(state: RoomState, now: number): RoomState {
  return touch(
    { ...state, phase: "finished", question: null, finishedAt: now },
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
  if (state.phase === "playing" && state.question) {
    return Math.min(
      state.question.expiresAt,
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

/** What a member is allowed to see. The answer never crosses the wire. */
export type RoomPublicState = {
  code: string
  gameSlug: string
  phase: RoomPhase
  hostId: string
  questionCount: number
  questionDurationMs: number
  members: {
    playerId: string
    name: string
    score: number
    connected: boolean
  }[]
  question: {
    prompt: { mediaUrl: string; caption?: string }
    options: { id: string; label: string }[]
    startedAt: number
    expiresAt: number
    answeredBy: string[]
  } | null
}

export function publicRoomState(state: RoomState): RoomPublicState {
  const question = state.question

  return {
    code: state.code,
    gameSlug: state.gameSlug,
    phase: state.phase,
    hostId: state.hostId,
    questionCount: state.questionCount,
    questionDurationMs: state.questionDurationMs,
    members: state.members.map((member) => ({ ...member })),
    question: question
      ? {
          prompt: { ...question.prompt },
          options: question.optionIds.map((id) => ({
            id,
            label: state.optionLabels[id] ?? "",
          })),
          startedAt: question.startedAt,
          expiresAt: question.expiresAt,
          answeredBy: [...question.answeredBy],
        }
      : null,
  }
}
