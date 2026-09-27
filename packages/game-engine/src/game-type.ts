import type { z } from "zod"

import type { ContentItem } from "./content.js"
import type { DictionaryEntry } from "./dictionary.js"
import type { BaseSettings } from "./settings.js"

/** The player's submission. Both variants resolve server-side to a real entity. */
export type Answer =
  | { kind: "option"; contentItemId: string }
  | { kind: "entry"; dictionaryEntryId: string }

export type AnswerResolution = {
  correct: boolean
  /** The content item the round was actually asking about, if any. */
  askedContentItemId: string | null
  /** Set when the submission could not be resolved at all. */
  reason?: "not_found" | "unsupported"
}

export type Round<TPayload> = {
  prompt: ContentItem<TPayload>
  options: ContentItem<TPayload>[]
}

export type ResolveAnswerInput<TPayload, TSettings> = {
  prompt: ContentItem<TPayload>
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
  /**
   * Which payload fields the runtime uses to render a round. Declaring them here
   * keeps the runtime, the panel and the API free of any game-type knowledge.
   */
  presentation: {
    promptMediaField: string
    optionLabelField: string
    promptCaptionField?: string
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
