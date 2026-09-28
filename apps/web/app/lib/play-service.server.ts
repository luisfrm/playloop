import type { ContentRepository } from "@playloop/db"
import {
  baseSettingsSchema,
  completeSession,
  countsForRanking,
  createSession,
  expireQuestion,
  finishSession,
  gameTypes,
  hasTimedOut,
  submitAnswer,
  type BaseSettings,
  type ContentItem,
  type GameInstance,
  type GameTypeDefinition,
  type SessionState,
} from "@playloop/game-engine"

import {
  SESSION_TTL_MS,
  type SessionStore,
  type StoredSession,
} from "./sessions.server"

export type PlayStats = {
  score: number
  lives: number
  streak: number
  roundsPlayed: number
  status: SessionState["status"]
}

export type BoardChipView = {
  id: string
  label: string
  mediaUrl: string
  caption?: string
  /** What the server already resolved for this cell, if anything. */
  resolved: "true" | "false" | null
}

export type PlayView = {
  sessionId: string
  slug: string
  board: BoardChipView[]
  /** Targets found so far. */
  found: number
  /** Targets on the board. */
  total: number
  stats: PlayStats
  questionDeadlineMs: number | null
  selectionDeadlineMs: number | null
  countsForRanking: boolean
}

export type AnswerResponse = {
  correct: boolean
  /** The cell was already locked: nothing changed. */
  alreadyResolved: boolean
  view: PlayView
  finished: boolean
}

type Payload = Record<string, unknown>

type AnyDefinition = GameTypeDefinition<Payload, BaseSettings>

function payloadOf(item: ContentItem<unknown>): Payload {
  return (item.payload ?? {}) as Payload
}

function textOf(payload: Payload, field: string | undefined): string {
  if (!field) return ""
  const value = payload[field]
  return typeof value === "string" ? value : ""
}

function statsOf(state: SessionState): PlayStats {
  return {
    score: state.score,
    lives: state.lives,
    streak: state.streak,
    roundsPlayed: state.roundsPlayed,
    status: state.status,
  }
}

function deadlines(session: StoredSession, settings: BaseSettings) {
  return {
    questionDeadlineMs:
      settings.questionTimeLimitSeconds === null
        ? null
        : session.state.roundStartedAt +
          settings.questionTimeLimitSeconds * 1000,
    selectionDeadlineMs:
      settings.selectionTimeLimitSeconds === null
        ? null
        : session.state.roundStartedAt +
          settings.selectionTimeLimitSeconds * 1000,
  }
}

function resolvedOf(
  session: StoredSession,
  id: string
): BoardChipView["resolved"] {
  if (!session.resolvedIds.includes(id)) return null
  return session.trueIds.includes(id) ? "true" : "false"
}

function viewOf(
  session: StoredSession,
  definition: AnyDefinition,
  options: ContentItem<Payload>[]
): PlayView {
  const settings = session.settings as BaseSettings
  const presentation = definition.presentation
  const byId = new Map(options.map((option) => [option.id, option]))

  const board: BoardChipView[] = session.orderedIds.flatMap((id) => {
    const item = byId.get(id)
    if (!item) return []
    const payload = payloadOf(item)
    return [
      {
        id,
        label: textOf(payload, presentation.optionLabelField),
        mediaUrl: textOf(payload, presentation.optionMediaField),
        caption: textOf(payload, presentation.optionCaptionField) || undefined,
        resolved: resolvedOf(session, id),
      },
    ]
  })

  return {
    sessionId: session.id,
    slug: session.slug,
    board,
    found: session.trueIds.filter((id) => session.resolvedIds.includes(id))
      .length,
    total: session.trueIds.length,
    stats: statsOf(session.state),
    ...deadlines(session, settings),
    countsForRanking: countsForRanking(session.state),
  }
}

/**
 * The target set, frozen at start. Derived through the authoritative check
 * itself, so this service never reads a game-type field directly.
 */
function targetIdsOf(
  definition: AnyDefinition,
  options: ContentItem<Payload>[],
  settings: BaseSettings
): string[] {
  return options
    .filter(
      (option) =>
        definition.resolveAnswer({
          options,
          settings,
          dictionary: [],
          answer: { kind: "option", contentItemId: option.id },
        }).correct
    )
    .map((option) => option.id)
}

export type StartInput = {
  repository: ContentRepository
  store: SessionStore
  instance: GameInstance
  playerId: string
  random?: () => number
}

export class PlayError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "invalid_settings" | "no_content" | "expired"
  ) {
    super(message)
  }
}

export async function startSession(input: StartInput): Promise<PlayView> {
  const { repository, store, instance, playerId } = input
  const definition = gameTypes.require(instance.gameTypeKey) as AnyDefinition

  const settingsResult = definition.settingsSchema.safeParse(instance.settings)
  if (!settingsResult.success) {
    throw new PlayError(
      "La configuración de la instancia no es válida.",
      "invalid_settings"
    )
  }
  const settings = { ...baseSettingsSchema.parse({}), ...settingsResult.data }

  const content = (await repository.listContent(
    instance.id
  )) as ContentItem<Payload>[]

  const round = definition.buildRound({
    pool: content,
    settings,
    random: input.random,
  })
  if (!round) {
    throw new PlayError(
      "La instancia todavía no tiene contenido suficiente.",
      "no_content"
    )
  }

  const state = createSession({
    sessionId: crypto.randomUUID(),
    gameInstanceId: instance.id,
    playerId,
    settings,
    now: Date.now(),
  })

  const orderedIds = round.options.map((option) => option.id)
  const session: StoredSession = {
    id: state.sessionId,
    instanceId: instance.id,
    slug: instance.slug,
    playerId,
    settings,
    state,
    orderedIds,
    trueIds: targetIdsOf(definition, round.options, settings),
    resolvedIds: [],
    bestStreak: 0,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }

  await store.put(session)
  return viewOf(session, definition, round.options)
}

export type AnswerInput = {
  repository: ContentRepository
  store: SessionStore
  session: StoredSession
  /** The picked board cell. */
  answerId: string
}

async function loadBoard(
  repository: ContentRepository,
  session: StoredSession
): Promise<ContentItem<Payload>[]> {
  const items = (await repository.listContent(
    session.instanceId
  )) as ContentItem<Payload>[]
  const byId = new Map(items.map((item) => [item.id, item]))

  return session.orderedIds
    .map((id) => byId.get(id))
    .filter((item): item is ContentItem<Payload> => item !== undefined)
}

/**
 * The single place a score can change. The client sends an opaque id; the
 * resolution happens here, against the real content. Re-picking a locked cell
 * — or inventing an id — changes nothing.
 */
export async function answerRound(input: AnswerInput): Promise<AnswerResponse> {
  const { repository, store, session, answerId } = input
  const definition = gameTypes.require(
    (await repository.getInstanceById(session.instanceId))?.gameTypeKey ??
      "true_false"
  ) as AnyDefinition

  const settings = session.settings as BaseSettings
  const now = Date.now()
  const options = await loadBoard(repository, session)

  if (
    session.state.status !== "running" ||
    hasTimedOut(session.state, settings, now)
  ) {
    const state =
      session.state.status === "running"
        ? finishSession(session.state, "expired")
        : session.state
    const finishedSession = { ...session, state }
    await store.put(finishedSession)
    return {
      correct: false,
      alreadyResolved: false,
      view: viewOf(finishedSession, definition, options),
      finished: true,
    }
  }

  if (
    !session.orderedIds.includes(answerId) ||
    session.resolvedIds.includes(answerId)
  ) {
    return {
      correct: false,
      alreadyResolved: true,
      view: viewOf(session, definition, options),
      finished: false,
    }
  }

  const resolution = definition.resolveAnswer({
    options,
    settings,
    dictionary: [],
    answer: { kind: "option", contentItemId: answerId },
  })
  const outcome = submitAnswer(session.state, settings, resolution, now)
  const resolvedIds = [...session.resolvedIds, answerId]
  // Content removed mid-game cannot block the win: only targets still on the
  // board count.
  const openTargets = session.trueIds.filter((id) =>
    options.some((option) => option.id === id)
  )

  let state = outcome.state
  let finished = state.status !== "running"
  if (
    !finished &&
    resolution.correct &&
    openTargets.every((id) => resolvedIds.includes(id))
  ) {
    state = completeSession(state, definition.completionBonus)
    finished = true
  }

  const updated: StoredSession = {
    ...session,
    state,
    resolvedIds,
    bestStreak: Math.max(session.bestStreak, state.streak),
    expiresAt: now + SESSION_TTL_MS,
  }
  await store.put(updated)

  return {
    correct: outcome.correct,
    alreadyResolved: false,
    view: viewOf(updated, definition, options),
    finished,
  }
}

/** The selection timer fired on the server — client timers are never trusted. */
export async function expireRound(input: {
  repository: ContentRepository
  store: SessionStore
  session: StoredSession
}): Promise<AnswerResponse> {
  const { repository, store, session } = input
  const definition = gameTypes.require(
    (await repository.getInstanceById(session.instanceId))?.gameTypeKey ??
      "true_false"
  ) as AnyDefinition

  const settings = session.settings as BaseSettings
  const now = Date.now()
  const options = await loadBoard(repository, session)

  if (session.state.status !== "running") {
    return {
      correct: false,
      alreadyResolved: false,
      view: viewOf(session, definition, options),
      finished: true,
    }
  }

  // The board's timeout policy decides: lose the whole run, or a single life.
  const state =
    definition.timeoutPolicy === "lose-match"
      ? finishSession(
          session.state,
          hasTimedOut(session.state, settings, now) ? "expired" : "lost"
        )
      : expireQuestion(session.state, settings, now).state
  const finished = state.status !== "running"
  const updated: StoredSession = {
    ...session,
    state,
    expiresAt: now + SESSION_TTL_MS,
  }
  await store.put(updated)

  return {
    correct: false,
    alreadyResolved: false,
    view: viewOf(updated, definition, options),
    finished,
  }
}

/**
 * Persist a finished ranked attempt. Practice never reaches the leaderboard.
 *
 * Idempotent by design: the session is read back from the store and stamped
 * before the score is written, so replaying an answer on a finished session
 * cannot inflate the ranking.
 */
export async function recordScore(input: {
  repository: ContentRepository
  store: SessionStore
  sessionId: string
  finished: boolean
}): Promise<boolean> {
  const { repository, store, sessionId, finished } = input
  if (!finished) return false

  const session = await store.get(sessionId)
  if (!session || session.recordedAt || !countsForRanking(session.state)) {
    return false
  }
  await store.put({ ...session, recordedAt: Date.now() })

  await repository.saveScore({
    id: crypto.randomUUID(),
    gameInstanceId: session.instanceId,
    playerId: session.playerId,
    score: session.state.score,
    roundsPlayed: session.state.roundsPlayed,
    bestStreak: session.bestStreak,
    mode: session.state.mode,
    ranked: true,
    createdAt: Date.now(),
  })

  return true
}
