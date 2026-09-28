import type { z } from "zod"

import type { ContentItem } from "./content.js"
import type { DictionaryEntry } from "./dictionary.js"
import type { BaseSettings } from "./settings.js"

/** The player's submission: the id of the board item they picked. */
export type Answer = { kind: "option"; contentItemId: string }

export type AnswerResolution = {
  correct: boolean
  /** The board item the submission resolved against, if any. */
  askedContentItemId: string | null
  /** Set when the submission could not be resolved at all. */
  reason?: "not_found" | "unsupported"
}

/** One board: every option the player can pick, in display order. */
export type Round<TPayload> = {
  options: ContentItem<TPayload>[]
}

export type ResolveAnswerInput<TPayload, TSettings> = {
  options: ContentItem<TPayload>[]
  settings: TSettings
  dictionary: readonly DictionaryEntry[]
  answer: Answer
}

export type BuildRoundInput<TPayload, TSettings> = {
  pool: readonly ContentItem<TPayload>[]
  settings: TSettings
  /** Deterministic hook so rounds are reproducible in tests and on the server. */
  random?: () => number
}

export type TimeoutPolicy = "lose-life" | "lose-match"

/**
 * The contract every game type fulfils. Everything the engine, the panel and
 * the server need to know about a game type flows through this object — no
 * switch statements anywhere else in the codebase.
 */
export interface GameTypeDefinition<
  TPayload = unknown,
  TSettings extends BaseSettings = BaseSettings,
> {
  key: string
  label: string
  description: string
  contentSchema: z.ZodType<TPayload>
  settingsSchema: z.ZodType<TSettings>
  /** When true, the panel requires a dictionary before enabling the mode. */
  requiresDictionary: boolean
  /** What a selection timeout does to a live session. */
  timeoutPolicy: TimeoutPolicy
  /** Extra points paid when the board is completed. */
  completionBonus: number
  /**
   * Which payload fields the runtime uses to render a board. Declaring them
   * here keeps the runtime, the panel and the API free of any game-type
   * knowledge.
   */
  presentation: {
    optionLabelField: string
    optionMediaField?: string
    optionCaptionField?: string
  }
  /** Build one presentable round out of the instance pool. */
  buildRound(
    input: BuildRoundInput<TPayload, TSettings>
  ): Round<TPayload> | null
  /** Authoritative check. Only ever called on the server. */
  resolveAnswer(
    input: ResolveAnswerInput<TPayload, TSettings>
  ): AnswerResolution
}

export type GameTypeSummary = {
  key: string
  label: string
  description: string
  requiresDictionary: boolean
}
