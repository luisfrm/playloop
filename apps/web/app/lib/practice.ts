import {
  baseSettingsSchema,
  completeSession,
  createSession,
  expireQuestion,
  finishSession,
  gameTypes,
  hasTimedOut,
  questionDeadline,
  selectionDeadline,
  submitAnswer,
  type BaseSettings,
  type ContentItem,
  type GameTypeDefinition,
  type SessionState,
} from "@playloop/game-engine"

import type { OfflineInstance } from "./offline"

/**
 * Practice mode: the whole board loop runs in the browser against a downloaded
 * instance, so a game works with no network at all.
 *
 * Two consequences are deliberate and permanent:
 *
 * 1. The answers are on the device by necessity. Nothing here is trustworthy,
 *    which is exactly why `mode` is forced to `practice` and the score can never
 *    reach the ranking.
 * 2. Every function is pure and takes its clock as an argument, so the loop is
 *    testable without a browser.
 *
 * The online flow keeps its authority on the server; this module deliberately
 * shares the engine, not the service.
 */

export type PracticeStats = {
  score: number
  lives: number
  streak: number
  roundsPlayed: number
  status: SessionState["status"]
}

export type PracticeChip = {
  id: string
  label: string
  mediaUrl: string
  caption?: string
  resolved: "true" | "false" | null
}

export type PracticeView = {
  board: PracticeChip[]
  found: number
  total: number
  stats: PracticeStats
  questionDeadlineMs: number | null
  selectionDeadlineMs: number | null
}

export type PracticeState = {
  instance: OfflineInstance
  settings: BaseSettings
  session: SessionState
  /** Board order, frozen at start. */
  orderedIds: string[]
  /** The ids the player must find, frozen at start. */
  trueIds: string[]
  /** Ids already picked, true or false: locked cells. */
  resolvedIds: string[]
  finished: boolean
}

export type PracticeAnswer = {
  state: PracticeState
  correct: boolean
  /** The cell was already locked: nothing changed. */
  alreadyResolved: boolean
}

type Payload = Record<string, unknown>

type AnyDefinition = GameTypeDefinition<Payload, BaseSettings>

function definitionOf(instance: OfflineInstance): AnyDefinition {
  return gameTypes.require(instance.gameTypeKey) as AnyDefinition
}

/**
 * Settings come from the instance, but the mode is forced: an offline session
 * is never ranked, no matter what the stored settings say.
 */
function settingsOf(instance: OfflineInstance): BaseSettings {
  const parsed = definitionOf(instance).settingsSchema.safeParse(
    instance.settings
  )
  const base = {
    ...baseSettingsSchema.parse({}),
    ...(parsed.success ? parsed.data : {}),
  } as BaseSettings
  return { ...base, mode: "practice" }
}

function poolOf(instance: OfflineInstance): ContentItem<Payload>[] {
  return instance.content.map((item, position) => ({
    id: item.id,
    gameInstanceId: instance.instanceId,
    position,
    payload: (item.payload ?? {}) as Payload,
  }))
}

function textOf(payload: Payload, field: string | undefined): string {
  if (!field) return ""
  const value = payload[field]
  return typeof value === "string" ? value : ""
}

function resolvedOf(
  state: PracticeState,
  id: string
): PracticeChip["resolved"] {
  if (!state.resolvedIds.includes(id)) return null
  return state.trueIds.includes(id) ? "true" : "false"
}

function statsOf(session: SessionState): PracticeStats {
  return {
    score: session.score,
    lives: session.lives,
    streak: session.streak,
    roundsPlayed: session.roundsPlayed,
    status: session.status,
  }
}

function boardOf(state: PracticeState): ContentItem<Payload>[] {
  const byId = new Map(poolOf(state.instance).map((item) => [item.id, item]))
  return state.orderedIds
    .map((id) => byId.get(id))
    .filter((item): item is ContentItem<Payload> => item !== undefined)
}

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

export function startPractice(
  instance: OfflineInstance,
  random: () => number = Math.random,
  now: number = Date.now()
): PracticeState | null {
  const settings = settingsOf(instance)
  const pool = poolOf(instance)

  const round = definitionOf(instance).buildRound({ pool, settings, random })
  if (!round) return null

  return {
    instance,
    settings,
    session: createSession({
      sessionId: `practice:${instance.slug}`,
      gameInstanceId: instance.instanceId,
      playerId: "offline",
      settings,
      now,
    }),
    orderedIds: round.options.map((option) => option.id),
    trueIds: targetIdsOf(definitionOf(instance), round.options, settings),
    resolvedIds: [],
    finished: false,
  }
}

export function practiceView(state: PracticeState): PracticeView | null {
  const options = boardOf(state)
  if (options.length === 0) return null

  const presentation = definitionOf(state.instance).presentation
  const byId = new Map(options.map((option) => [option.id, option]))

  const board: PracticeChip[] = state.orderedIds.flatMap((id) => {
    const item = byId.get(id)
    if (!item) return []
    return [
      {
        id,
        label: textOf(item.payload, presentation.optionLabelField),
        mediaUrl: textOf(item.payload, presentation.optionMediaField),
        caption:
          textOf(item.payload, presentation.optionCaptionField) || undefined,
        resolved: resolvedOf(state, id),
      },
    ]
  })

  return {
    board,
    found: state.trueIds.filter((id) => state.resolvedIds.includes(id)).length,
    total: state.trueIds.length,
    stats: statsOf(state.session),
    questionDeadlineMs: questionDeadline(state.session, state.settings),
    selectionDeadlineMs: selectionDeadline(state.session, state.settings),
  }
}

/** Shared tail of `answerPractice` and `expirePractice`. */
function settle(
  state: PracticeState,
  session: SessionState,
  correct: boolean,
  alreadyResolved: boolean,
  now: number
): PracticeAnswer {
  const over =
    session.status !== "running" || hasTimedOut(session, state.settings, now)

  return {
    state: {
      ...state,
      session: over ? finishSession(session) : session,
      finished: over,
    },
    correct,
    alreadyResolved,
  }
}

export function answerPractice(
  state: PracticeState,
  answerId: string,
  now: number = Date.now()
): PracticeAnswer {
  if (
    state.finished ||
    state.session.status !== "running" ||
    hasTimedOut(state.session, state.settings, now)
  ) {
    return settle(
      state,
      finishSession(state.session, "expired"),
      false,
      false,
      now
    )
  }

  if (
    !state.orderedIds.includes(answerId) ||
    state.resolvedIds.includes(answerId)
  ) {
    return { state, correct: false, alreadyResolved: true }
  }

  const definition = definitionOf(state.instance)
  const options = boardOf(state)
  const resolution = definition.resolveAnswer({
    options,
    settings: state.settings,
    dictionary: [],
    answer: { kind: "option", contentItemId: answerId },
  })
  const outcome = submitAnswer(state.session, state.settings, resolution, now)
  const resolvedIds = [...state.resolvedIds, answerId]
  const openTargets = state.trueIds.filter((id) =>
    options.some((option) => option.id === id)
  )

  let session = outcome.state
  if (
    session.status === "running" &&
    resolution.correct &&
    openTargets.every((id) => resolvedIds.includes(id))
  ) {
    session = completeSession(session, definition.completionBonus)
  }

  return settle({ ...state, resolvedIds }, session, outcome.correct, false, now)
}

/** The local selection timer fired: the board's policy decides the cost. */
export function expirePractice(
  state: PracticeState,
  now: number = Date.now()
): PracticeAnswer {
  if (state.finished || state.session.status !== "running") {
    return { state, correct: false, alreadyResolved: false }
  }

  const definition = definitionOf(state.instance)
  const session =
    definition.timeoutPolicy === "lose-match"
      ? finishSession(
          state.session,
          hasTimedOut(state.session, state.settings, now) ? "expired" : "lost"
        )
      : expireQuestion(state.session, state.settings, now).state

  return settle(state, session, false, false, now)
}
