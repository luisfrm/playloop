import { z } from "zod"

import type { ContentItem } from "../../content.js"
import {
  entryLookupKeys,
  normalizeValue,
  type DictionaryEntry,
} from "../../dictionary.js"
import type {
  AnswerResolution,
  BuildRoundInput,
  GameTypeDefinition,
  Round,
} from "../../game-type.js"
import { label, longText, mediaUrl } from "../../primitives.js"
import { baseSettingsSchema } from "../../settings.js"

/** One option of a round: the thing the player can pick. */
export const trueFalseContentSchema = z.object({
  /** Shown to the player as an option and as the prompt caption. */
  label: label.meta({ title: "Etiqueta" }),
  /** Media for this option — shown when the item is the prompt. */
  mediaUrl: mediaUrl.meta({ title: "Imagen" }),
  description: longText.optional().meta({ title: "Descripción" }),
  /** Only items flagged here can become the shown prompt. */
  isCorrectPool: z
    .boolean()
    .default(true)
    .meta({ title: "Puede ser pregunta" }),
  /**
   * Optional explicit key used by expert mode to bind this item to a dictionary
   * entry. Falls back to `label` when absent.
   */
  answerKey: label.optional().meta({ title: "Clave de respuesta" }),
})

export type TrueFalseContent = z.infer<typeof trueFalseContentSchema>

/** Classic = multiple choice. Expert = autocomplete against the dictionary. */
export const trueFalseSettingsSchema = baseSettingsSchema.extend({
  answerMode: z
    .enum(["classic", "expert"])
    .default("classic")
    .meta({ title: "Modo de respuesta" }),
})

export type TrueFalseSettings = z.infer<typeof trueFalseSettingsSchema>

/** Pick a prompt from the pool; falls back to the whole pool when unmarked. */
function pickPromptPool(pool: readonly ContentItem<TrueFalseContent>[]) {
  const marked = pool.filter((item) => item.payload.isCorrectPool)
  return marked.length > 0 ? marked : pool
}

/** Deterministic selection so the server can reproduce a round. */
function pickIndex(length: number, random: () => number): number {
  if (length <= 1) return 0
  return Math.min(length - 1, Math.floor(random() * length))
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1, random)
    const a = copy[i] as T
    const b = copy[j] as T
    copy[i] = b
    copy[j] = a
  }
  return copy
}

type TrueFalseRoundInput = BuildRoundInput<TrueFalseContent, TrueFalseSettings>

function buildClassicRound(
  input: TrueFalseRoundInput
): Round<TrueFalseContent> | null {
  const { pool, settings, random = Math.random } = input
  if (pool.length < 2) return null

  const promptPool = pickPromptPool(pool)
  const prompt = promptPool[pickIndex(promptPool.length, random)]
  if (!prompt) return null

  const distractorCount = Math.min(settings.optionCount - 1, pool.length - 1)
  const distractors = shuffle(
    pool.filter((item) => item.id !== prompt.id),
    random
  ).slice(0, distractorCount)

  return { prompt, options: shuffle([prompt, ...distractors], random) }
}

/** The value an item is expected to be answered with. */
function expectedKey(payload: TrueFalseContent): string {
  return normalizeValue(payload.answerKey ?? payload.label)
}

function resolveClassic(
  prompt: ContentItem<TrueFalseContent>,
  answer: { kind: "option"; contentItemId: string }
): AnswerResolution {
  return {
    correct: answer.contentItemId === prompt.id,
    askedContentItemId: prompt.id,
  }
}

function resolveExpert(
  prompt: ContentItem<TrueFalseContent>,
  dictionary: readonly DictionaryEntry[],
  answer: { kind: "entry"; dictionaryEntryId: string }
): AnswerResolution {
  const entry = dictionary.find(
    (candidate) => candidate.id === answer.dictionaryEntryId
  )
  if (!entry) {
    return {
      correct: false,
      askedContentItemId: prompt.id,
      reason: "not_found",
    }
  }
  return {
    correct: entryLookupKeys(entry).includes(expectedKey(prompt.payload)),
    askedContentItemId: prompt.id,
  }
}

/**
 * `true_false`: one prompt, several options, one of them correct.
 *
 * Expert mode never compares free text — the player selects a dictionary entry
 * and the server compares normalised keys, so a typo can never be the reason a
 * score changed.
 */
export const trueFalseGameType: GameTypeDefinition<
  TrueFalseContent,
  TrueFalseSettings
> = {
  key: "true_false",
  label: "Verdadero o falso",
  description:
    "Se muestra un elemento y varias opciones. En modo clásico se elige una; en modo experto se autocompleta contra el diccionario.",
  contentSchema: trueFalseContentSchema,
  settingsSchema: trueFalseSettingsSchema,
  requiresDictionary: true,
  presentation: {
    promptMediaField: "mediaUrl",
    optionLabelField: "label",
    promptCaptionField: "description",
  },

  buildRound(input) {
    return buildClassicRound(input)
  },

  resolveAnswer({ prompt, dictionary, answer }) {
    if (answer.kind === "option") return resolveClassic(prompt, answer)
    return resolveExpert(prompt, dictionary, answer)
  },
}
