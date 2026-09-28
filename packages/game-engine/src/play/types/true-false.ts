import { z } from "zod"

import type { ContentItem } from "../../content.js"
import type {
  AnswerResolution,
  BuildRoundInput,
  GameTypeDefinition,
  Round,
} from "../../game-type.js"
import { label, longText, mediaUrl } from "../../primitives.js"
import { baseSettingsSchema } from "../../settings.js"

/** One board cell: the player marks it when they believe it holds. */
export const trueFalseContentSchema = z.object({
  /** Shown on the cell: the statement the player judges. */
  label: label.meta({ title: "Etiqueta" }),
  /** Illustrates the cell. */
  mediaUrl: mediaUrl.meta({ title: "Imagen" }),
  description: longText.optional().meta({ title: "Descripción" }),
  /** Cells flagged here are the ones the player must find. */
  isTrue: z.boolean().default(true).meta({ title: "Es verdadero" }),
})

export type TrueFalseContent = z.infer<typeof trueFalseContentSchema>

/** The board needs no settings of its own: lives and timers come from base. */
export const trueFalseSettingsSchema = baseSettingsSchema

export type TrueFalseSettings = z.infer<typeof trueFalseSettingsSchema>

/**
 * Rows written before the flag existed carry no mark: an absent mark counts
 * as a target, so legacy boards stay completable.
 */
function isMarkedTrue(payload: TrueFalseContent): boolean {
  return (payload as { isTrue?: unknown }).isTrue !== false
}

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

function buildBoardRound(
  input: TrueFalseRoundInput
): Round<TrueFalseContent> | null {
  const { pool, random = Math.random } = input
  if (pool.length < 2) return null
  const targets = pool.filter((item) => isMarkedTrue(item.payload))
  if (targets.length === 0 || targets.length === pool.length) return null
  return { options: shuffle(pool, random) }
}

function resolvePick(
  options: readonly ContentItem<TrueFalseContent>[],
  contentItemId: string
): AnswerResolution {
  const target = options.find((option) => option.id === contentItemId)
  if (!target) {
    return {
      correct: false,
      askedContentItemId: null,
      reason: "not_found",
    }
  }
  return {
    correct: isMarkedTrue(target.payload),
    askedContentItemId: target.id,
  }
}

/**
 * `true_false`: a single board with every item on it. The player marks each
 * cell they believe holds; a miss costs a life and the cell locks either way.
 */
export const trueFalseGameType: GameTypeDefinition<
  TrueFalseContent,
  TrueFalseSettings
> = {
  key: "true_false",
  label: "Verdadero o falso",
  description:
    "Un tablero con todos los elementos: marca los verdaderos. Cada falso cuesta una vida.",
  contentSchema: trueFalseContentSchema,
  settingsSchema: trueFalseSettingsSchema,
  requiresDictionary: false,
  timeoutPolicy: "lose-match",
  completionBonus: 2,
  presentation: {
    optionLabelField: "label",
    optionMediaField: "mediaUrl",
    optionCaptionField: "description",
  },

  buildRound(input) {
    return buildBoardRound(input)
  },

  resolveAnswer({ options, answer }) {
    return resolvePick(options, answer.contentItemId)
  },
}
