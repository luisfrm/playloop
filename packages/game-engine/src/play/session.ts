import type { AnswerResolution } from "../game-type.js"
import type { BaseSettings, PlayMode } from "../settings.js"

export type SessionStatus = "running" | "won" | "lost" | "expired"

export interface SessionState {
  sessionId: string
  gameInstanceId: string
  playerId: string
  mode: PlayMode
  score: number
  lives: number
  streak: number
  roundsPlayed: number
  status: SessionStatus
  startedAt: number
  roundStartedAt: number
  lastAnswerAt: number | null
}

export type AnswerOutcome = {
  state: SessionState
  correct: boolean
  /** Set when the submission could not change the session at all. */
  rejectedReason?: "session_finished" | "total_time_exceeded"
}

export type CreateSessionInput = {
  sessionId: string
  gameInstanceId: string
  playerId: string
  settings: BaseSettings
  now: number
}

/** One correct answer is always worth one point. Kept as a named constant so
 * the scoring rule is documented rather than sprinkled through the code. */
export const POINTS_PER_CORRECT = 1

function isPast(deadline: number | null, now: number): boolean {
  return deadline !== null && now > deadline
}

export function totalTimeDeadline(
  state: SessionState,
  settings: BaseSettings
): number | null {
  return settings.totalTimeLimitSeconds === null
    ? null
    : state.startedAt + settings.totalTimeLimitSeconds * 1000
}

export function questionDeadline(
  state: SessionState,
  settings: BaseSettings
): number | null {
  return settings.questionTimeLimitSeconds === null
    ? null
    : state.roundStartedAt + settings.questionTimeLimitSeconds * 1000
}

export function selectionDeadline(
  state: SessionState,
  settings: BaseSettings
): number | null {
  return settings.selectionTimeLimitSeconds === null
    ? null
    : state.roundStartedAt + settings.selectionTimeLimitSeconds * 1000
}

export function hasTimedOut(
  state: SessionState,
  settings: BaseSettings,
  now: number
): boolean {
  return isPast(totalTimeDeadline(state, settings), now)
}

/**
 * Only ranked modes feed the leaderboard. Practice (offline / PWA) sessions are
 * resolved locally and deliberately excluded — the client holds the answers
 * there, so the score cannot be trusted.
 */
export function countsForRanking(state: Pick<SessionState, "mode">): boolean {
  return state.mode === "solo" || state.mode === "online"
}

export function createSession(input: CreateSessionInput): SessionState {
  const { settings, now } = input
  return {
    sessionId: input.sessionId,
    gameInstanceId: input.gameInstanceId,
    playerId: input.playerId,
    mode: settings.mode,
    score: 0,
    lives: settings.lives,
    streak: 0,
    roundsPlayed: 0,
    status: "running",
    startedAt: now,
    roundStartedAt: now,
    lastAnswerAt: null,
  }
}

function isFinished(status: SessionStatus): boolean {
  return status !== "running"
}

/** Deterministic transition: correct → score up; wrong → a life down. */
export function submitAnswer(
  state: SessionState,
  settings: BaseSettings,
  resolution: AnswerResolution,
  now: number
): AnswerOutcome {
  if (isFinished(state.status)) {
    return { state, correct: false, rejectedReason: "session_finished" }
  }
  if (hasTimedOut(state, settings, now)) {
    return {
      state: { ...state, status: "expired" },
      correct: false,
      rejectedReason: "total_time_exceeded",
    }
  }

  const roundsPlayed = state.roundsPlayed + 1
  const correct = resolution.correct
  const score = correct ? state.score + POINTS_PER_CORRECT : state.score
  const streak = correct ? state.streak + 1 : 0
  const lives = correct ? state.lives : state.lives - 1

  return {
    state: {
      ...state,
      score,
      streak,
      lives,
      roundsPlayed,
      lastAnswerAt: now,
      status: lives <= 0 ? "lost" : "running",
    },
    correct,
  }
}

/**
 * The selection timer fired: the question is lost without an answer.
 *
 * The signature mirrors `submitAnswer` so both transitions are called the same
 * way; expiring only depends on the state, so the last two are ignored.
 */
export function expireQuestion(
  state: SessionState,
  _settings: BaseSettings,
  _now: number
): AnswerOutcome {
  if (isFinished(state.status)) {
    return { state, correct: false, rejectedReason: "session_finished" }
  }
  const lives = state.lives - 1
  return {
    state: {
      ...state,
      lives,
      streak: 0,
      roundsPlayed: state.roundsPlayed + 1,
      status: lives <= 0 ? "lost" : "running",
    },
    correct: false,
  }
}

/**
 * The next round is on screen: the selection clock starts here, never on the
 * previous answer. Reading the feedback for longer than the limit must not eat
 * the time the player has to choose in the following round.
 */
export function beginRound(state: SessionState, now: number): SessionState {
  return { ...state, roundStartedAt: now }
}

/** Ending a session early keeps whatever score was already earned. */
export function finishSession(
  state: SessionState,
  status: SessionStatus = "won"
): SessionState {
  if (isFinished(state.status)) return state
  return { ...state, status }
}
