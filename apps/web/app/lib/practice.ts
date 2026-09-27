import {
  baseSettingsSchema,
  createSession,
  expireQuestion,
  finishSession,
  gameTypes,
  hasTimedOut,
  selectionDeadline,
  submitAnswer,
  type AnswerResolution,
  type BaseSettings,
  type ContentItem,
  type GameTypeDefinition,
  type SessionState,
} from "@playloop/game-engine"

import type { OfflineInstance } from "./offline"

/**
 * Practice mode: the whole round loop runs in the browser against a downloaded
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

export type PracticeView = {
  answerMode: "classic" | "expert"
  prompt: { mediaUrl: string; caption?: string }
  options: { id: string; label: string }[]
  dictionary: { id: string; value: string }[]
  stats: PracticeStats
  selectionDeadlineMs: number | null
}

export type PracticeState = {
  instance: OfflineInstance
  answerMode: "classic" | "expert"
  settings: BaseSettings
  session: SessionState
  promptId: string
  optionIds: string[]
  /** Only ever populated in expert mode. */
  dictionary: OfflineInstance["dictionary"]
  /** Every prompt already served, so a round is not repeated while it can be. */
  askedIds: string[]
  finished: boolean
}

export type PracticeAnswer = {
  state: PracticeState
  correct: boolean
  revealedLabel: string
}

type Payload = Record<string, unknown>

type AnyDefinition = GameTypeDefinition<
  Payload,
  BaseSettings & { answerMode?: "classic" | "expert" }
>

const OFFLINE_PLAYER_ID = "offline"

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

function answerModeFor(
  instance: OfflineInstance,
  requested: "classic" | "expert"
): "classic" | "expert" {
  if (requested !== "expert") return "classic"
  return instance.dictionary.length > 0 ? "expert" : "classic"
}

function buildRound(
  definition: AnyDefinition,
  pool: ContentItem<Payload>[],
  settings: BaseSettings,
  askedIds: string[],
  random: () => number
) {
  const fresh = pool.filter((item) => !askedIds.includes(item.id))
  const usable = fresh.length >= 2 ? fresh : pool
  return definition.buildRound({ pool: usable, settings, random })
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

function roundOf(
  state: PracticeState
): { prompt: ContentItem<Payload>; options: ContentItem<Payload>[] } | null {
  const byId = new Map(poolOf(state.instance).map((item) => [item.id, item]))
  const prompt = byId.get(state.promptId)
  if (!prompt) return null

  return {
    prompt,
    options: state.optionIds
      .map((id) => byId.get(id))
      .filter((item): item is ContentItem<Payload> => item !== undefined),
  }
}

export function startPractice(
  instance: OfflineInstance,
  requestedMode: "classic" | "expert" = "classic",
  random: () => number = Math.random,
  now: number = Date.now()
): PracticeState | null {
  const settings = settingsOf(instance)
  const pool = poolOf(instance)
  if (pool.length < 2) return null

  const round = buildRound(definitionOf(instance), pool, settings, [], random)
  if (!round) return null

  const answerMode = answerModeFor(instance, requestedMode)

  return {
    instance,
    answerMode,
    settings,
    session: createSession({
      sessionId: `practice:${instance.slug}`,
      gameInstanceId: instance.instanceId,
      playerId: OFFLINE_PLAYER_ID,
      settings,
      now,
    }),
    promptId: round.prompt.id,
    optionIds: round.options.map((option) => option.id),
    dictionary: answerMode === "expert" ? instance.dictionary : [],
    askedIds: [round.prompt.id],
    finished: false,
  }
}

/**
 * Serves the next round and restarts the selection clock from *now*.
 *
 * Kept separate from `answerPractice` on purpose: the clock must start when the
 * round is on screen, not when the previous answer was submitted — otherwise
 * reading the feedback for longer than the limit would expire the next round
 * before the player could see it.
 */
export function nextPracticeRound(
  state: PracticeState,
  random: () => number = Math.random,
  now: number = Date.now()
): PracticeState | null {
  if (state.finished) return null

  const round = buildRound(
    definitionOf(state.instance),
    poolOf(state.instance),
    state.settings,
    state.askedIds,
    random
  )
  if (!round) return null

  return {
    ...state,
    session: { ...state.session, roundStartedAt: now },
    promptId: round.prompt.id,
    optionIds: round.options.map((option) => option.id),
    askedIds: [...state.askedIds, round.prompt.id],
  }
}

export function practiceView(state: PracticeState): PracticeView | null {
  const round = roundOf(state)
  if (!round) return null

  const presentation = definitionOf(state.instance).presentation

  return {
    answerMode: state.answerMode,
    prompt: {
      mediaUrl: textOf(round.prompt.payload, presentation.promptMediaField),
      caption:
        textOf(round.prompt.payload, presentation.promptCaptionField) ||
        undefined,
    },
    options: round.options.map((option) => ({
      id: option.id,
      label: textOf(option.payload, presentation.optionLabelField),
    })),
    dictionary: state.dictionary.map((entry) => ({
      id: entry.id,
      value: entry.value,
    })),
    stats: statsOf(state.session),
    selectionDeadlineMs: selectionDeadline(state.session, state.settings),
  }
}

function resolve(
  state: PracticeState,
  answerId: string
): { resolution: AnswerResolution; revealedLabel: string } {
  const definition = definitionOf(state.instance)
  const round = roundOf(state)
  const revealedLabel = round
    ? textOf(round.prompt.payload, definition.presentation.optionLabelField)
    : ""

  if (!round) {
    return {
      resolution: { correct: false, askedContentItemId: state.promptId },
      revealedLabel,
    }
  }

  return {
    resolution: definition.resolveAnswer({
      prompt: round.prompt,
      options: round.options,
      settings: state.settings,
      dictionary: state.dictionary,
      answer:
        state.answerMode === "expert"
          ? { kind: "entry", dictionaryEntryId: answerId }
          : { kind: "option", contentItemId: answerId },
    }),
    revealedLabel,
  }
}

/** Shared tail of `answerPractice` and `expirePractice`. */
function settle(
  state: PracticeState,
  session: SessionState,
  correct: boolean,
  revealedLabel: string,
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
    revealedLabel,
  }
}

export function answerPractice(
  state: PracticeState,
  answerId: string,
  now: number = Date.now()
): PracticeAnswer {
  const { resolution, revealedLabel } = resolve(state, answerId)
  const outcome = submitAnswer(state.session, state.settings, resolution, now)
  return settle(state, outcome.state, outcome.correct, revealedLabel, now)
}

/** The local selection timer fired: the round is lost without an answer. */
export function expirePractice(
  state: PracticeState,
  now: number = Date.now()
): PracticeAnswer {
  const { revealedLabel } = resolve(state, state.promptId)
  const outcome = expireQuestion(state.session, state.settings, now)
  return settle(state, outcome.state, false, revealedLabel, now)
}
