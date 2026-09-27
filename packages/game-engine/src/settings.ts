import { z } from "zod"

/** How a game instance is played. Data, not code paths. */
export const playModeSchema = z.enum(["solo", "online", "coop", "practice"])
export type PlayMode = z.infer<typeof playModeSchema>

/**
 * Settings every game type shares. A game type extends this with its own
 * options; the panel renders both from the resulting schema.
 */
export const baseSettingsSchema = z.object({
  mode: playModeSchema.default("solo"),
  /** Null means "no limit". */
  totalTimeLimitSeconds: z
    .number()
    .int()
    .min(10)
    .max(3600)
    .nullable()
    .default(null),
  questionTimeLimitSeconds: z
    .number()
    .int()
    .min(3)
    .max(600)
    .nullable()
    .default(30),
  selectionTimeLimitSeconds: z
    .number()
    .int()
    .min(3)
    .max(120)
    .nullable()
    .default(15),
  lives: z.number().int().min(1).max(10).default(3),
  /** Ruleset knobs a game type may share: how many options a round shows. */
  optionCount: z.number().int().min(2).max(8).default(4),
})

export type BaseSettings = z.infer<typeof baseSettingsSchema>

export const DEFAULT_BASE_SETTINGS: BaseSettings = baseSettingsSchema.parse({})
