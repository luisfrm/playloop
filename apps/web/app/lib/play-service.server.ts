import type { ContentRepository } from "@playloop/db"
import {
  baseSettingsSchema,
  beginRound,
  countsForRanking,
  createSession,
  expireQuestion,
  finishSession,
  gameTypes,
  hasTimedOut,
  submitAnswer,
  type AnswerResolution,
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

export type PlayView = {
  sessionId: string
  slug: string
  answerMode: "classic" | "expert"
  /** The prompt never carries its own label — that is the answer. */
  prompt: { mediaUrl: string; caption?: string }
  options: { id: string; label: string }[]
  dictionary: { id: string; value: string }[]
  stats: PlayStats
  questionDeadlineMs: number | null
  selectionDeadlineMs: number | null
  countsForRanking: boolean
}

export type AnswerResponse = {
  correct: boolean
  revealed: { label: string; correctOptionId: string | null }
  stats: PlayStats
  /** The session goes on: the client asks for the next round to be served. */
  hasNext: boolean
  finished: boolean
}

/** What the client gets when it asks for the round after the feedback screen. */
export type ServeNextResult = {
  view: PlayView | null
  finished: boolean
}

type Payload = Record<string, unknown>

type AnyDefinition = GameTypeDefinition<
  Payload,
  BaseSettings & { answerMode?: "classic" | "expert" }
>

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

function viewOf(
  session: StoredSession,
  definition: AnyDefinition,
  prompt: ContentItem<Payload>,
  options: ContentItem<Payload>[]
): PlayView {
  const settings = session.settings as BaseSettings
  const presentation = definition.presentation

  return {
    sessionId: session.id,
    slug: session.slug,
    answerMode: session.answerMode,
    prompt: {
      mediaUrl: textOf(payloadOf(prompt), presentation.promptMediaField),
      caption:
        textOf(payloadOf(prompt), presentation.promptCaptionField) || undefined,
    },
    options: options.map((option) => ({
      id: option.id,
      label: textOf(payloadOf(option), presentation.optionLabelField),
    })),
    dictionary:
      session.answerMode === "expert"
        ? session.dictionary.map((entry) => ({
            id: entry.id,
            value: entry.value,
          }))
        : [],
    stats: statsOf(session.state),
    ...deadlines(session, settings),
    countsForRanking: countsForRanking(session.state),
  }
}

export type StartInput = {
  repository: ContentRepository
  store: SessionStore
  instance: GameInstance
  playerId: string
  /** Client-chosen mode; the server validates it against the instance gate. */
  requestedMode: "classic" | "expert"
  random?: () => number
}

export class PlayError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "invalid_settings"
      | "no_content"
      | "expert_unavailable"
      | "expired"
  ) {
    super(message)
  }
}

export async function startSession(input: StartInput): Promise<PlayView> {
  const { repository, store, instance, playerId, requestedMode } = input
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
  if (content.length < 2) {
    throw new PlayError(
      "La instancia todavía no tiene suficiente contenido.",
      "no_content"
    )
  }

  const dictionary = await repository.listDictionary(instance.id)
  const answerMode =
    requestedMode === "expert" &&
    instance.expertModeEnabled &&
    dictionary.length > 0
      ? "expert"
      : "classic"

  if (requestedMode === "expert" && answerMode === "classic") {
    throw new PlayError(
      "El modo experto no está disponible para esta instancia.",
      "expert_unavailable"
    )
  }

  const round = definition.buildRound({
    pool: content,
    settings,
    random: input.random,
  })
  if (!round) {
    throw new PlayError("No se pudo preparar una ronda.", "no_content")
  }

  const state = createSession({
    sessionId: crypto.randomUUID(),
    gameInstanceId: instance.id,
    playerId,
    settings,
    now: Date.now(),
  })

  const session: StoredSession = {
    id: state.sessionId,
    instanceId: instance.id,
    slug: instance.slug,
    playerId,
    settings,
    answerMode,
    state,
    promptId: round.prompt.id,
    optionIds: round.options.map((option) => option.id),
    askedIds: [round.prompt.id],
    bestStreak: 0,
    dictionary,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }

  await store.put(session)
  return viewOf(session, definition, round.prompt, round.options)
}

export type AnswerInput = {
  repository: ContentRepository
  store: SessionStore
  session: StoredSession
  /** The chosen option (classic) or dictionary entry (expert). */
  answerId: string
}

async function loadRoundParts(
  repository: ContentRepository,
  session: StoredSession
): Promise<{ prompt: ContentItem<Payload>; options: ContentItem<Payload>[] }> {
  const items = (await repository.listContent(
    session.instanceId
  )) as ContentItem<Payload>[]
  const byId = new Map(items.map((item) => [item.id, item]))

  const prompt = byId.get(session.promptId)
  const options = session.optionIds
    .map((id) => byId.get(id))
    .filter((item): item is ContentItem<Payload> => item !== undefined)

  if (!prompt)
    throw new PlayError(
      "La sesión apunta a contenido que ya no existe.",
      "not_found"
    )
  return { prompt, options }
}

function nextRound(
  session: StoredSession,
  definition: AnyDefinition,
  pool: ContentItem<Payload>[],
  random: (() => number) | undefined
): { prompt: ContentItem<Payload>; options: ContentItem<Payload>[] } | null {
  const fresh = pool.filter((item) => !session.askedIds.includes(item.id))
  const usable = fresh.length >= 2 ? fresh : pool
  return definition.buildRound({
    pool: usable,
    settings: session.settings as BaseSettings,
    random,
  })
}

/**
 * The single place a score can change. The client sends an opaque id; the
 * resolution happens here, against the real content.
 */
export async function answerRound(input: AnswerInput): Promise<AnswerResponse> {
  const { repository, store, session, answerId } = input
  const definition = gameTypes.require(
    (await repository.getInstanceById(session.instanceId))?.gameTypeKey ??
      "true_false"
  ) as AnyDefinition

  const { prompt, options } = await loadRoundParts(repository, session)

  const resolution: AnswerResolution = definition.resolveAnswer({
    prompt,
    options,
    settings: session.settings as BaseSettings,
    dictionary: session.dictionary,
    answer:
      session.answerMode === "expert"
        ? { kind: "entry", dictionaryEntryId: answerId }
        : { kind: "option", contentItemId: answerId },
  })

  const settings = session.settings as BaseSettings
  const now = Date.now()
  const outcome = submitAnswer(session.state, settings, resolution, now)

  const revealed = {
    label: textOf(payloadOf(prompt), definition.presentation.optionLabelField),
    correctOptionId: resolution.askedContentItemId,
  }

  if (
    outcome.state.status !== "running" ||
    hasTimedOut(outcome.state, settings, now)
  ) {
    const finished =
      outcome.state.status === "running"
        ? finishSession(outcome.state)
        : outcome.state
    await store.put({ ...session, state: finished, awaitingNext: false })
    return {
      correct: outcome.correct,
      revealed,
      stats: statsOf(finished),
      hasNext: false,
      finished: true,
    }
  }

  // The next round is not built yet: the clock starts when it is served, so the
  // feedback screen cannot eat the selection time.
  await store.put({
    ...session,
    state: outcome.state,
    bestStreak: Math.max(session.bestStreak, outcome.state.streak),
    awaitingNext: true,
    expiresAt: now + SESSION_TTL_MS,
  })

  return {
    correct: outcome.correct,
    revealed,
    stats: statsOf(outcome.state),
    hasNext: true,
    finished: false,
  }
}

/**
 * Serves the round that follows a feedback screen and restarts the selection
 * clock from *now*. Called when the player is ready, never at answer time.
 */
export async function serveNextRound(input: {
  repository: ContentRepository
  store: SessionStore
  session: StoredSession
  random?: () => number
}): Promise<ServeNextResult> {
  const { repository, store, session, random } = input
  const definition = gameTypes.require(
    (await repository.getInstanceById(session.instanceId))?.gameTypeKey ??
      "true_false"
  ) as AnyDefinition

  // Asking twice (a reload, a double click) just returns the round on screen.
  if (!session.awaitingNext) {
    const { prompt, options } = await loadRoundParts(repository, session)
    return { view: viewOf(session, definition, prompt, options), finished: false }
  }

  const now = Date.now()
  const pool = (await repository.listContent(
    session.instanceId
  )) as ContentItem<Payload>[]
  const round = nextRound(session, definition, pool, random)

  if (!round) {
    const finished = finishSession(session.state)
    await store.put({ ...session, state: finished, awaitingNext: false })
    return { view: null, finished: true }
  }

  const updated: StoredSession = {
    ...session,
    state: beginRound(session.state, now),
    promptId: round.prompt.id,
    optionIds: round.options.map((option) => option.id),
    askedIds: [...session.askedIds, round.prompt.id],
    awaitingNext: false,
    expiresAt: now + SESSION_TTL_MS,
  }
  await store.put(updated)

  return {
    view: viewOf(updated, definition, round.prompt, round.options),
    finished: false,
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

  const { prompt } = await loadRoundParts(repository, session)
  const settings = session.settings as BaseSettings
  const now = Date.now()
  const outcome = expireQuestion(session.state, settings, now)

  const revealed = {
    label: textOf(payloadOf(prompt), definition.presentation.optionLabelField),
    correctOptionId: session.promptId,
  }

  if (outcome.state.status !== "running") {
    await store.put({ ...session, state: outcome.state, awaitingNext: false })
    return {
      correct: false,
      revealed,
      stats: statsOf(outcome.state),
      hasNext: false,
      finished: true,
    }
  }

  await store.put({
    ...session,
    state: outcome.state,
    awaitingNext: true,
    expiresAt: now + SESSION_TTL_MS,
  })

  return {
    correct: false,
    revealed,
    stats: statsOf(outcome.state),
    hasNext: true,
    finished: false,
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
