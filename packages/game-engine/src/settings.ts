import { z } from "zod"

/** How a game instance is played. Data, not code paths. */
export const playModeSchema = z.enum(["solo", "online", "coop", "practice"])
export type PlayMode = z.infer<typeof playModeSchema>

/**
 * Settings every game type shares. A game type extends this with its own
 * options; the panel renders both from the resulting schema.
 */
export const baseSettingsSchema = z.object({
  mode: playModeSchema.default("solo").meta({ title: "Modo de juego" }),
  /** Null means "no limit". */
  totalTimeLimitSeconds: z
    .number()
    .int()
    .min(10)
    .max(3600)
    .nullable()
    .default(null)
    .meta({ title: "Tiempo total (segundos)" }),
  questionTimeLimitSeconds: z
    .number()
    .int()
    .min(3)
    .max(600)
    .nullable()
    .default(30)
    .meta({ title: "Tiempo por pregunta (segundos)" }),
  selectionTimeLimitSeconds: z
    .number()
    .int()
    .min(3)
    .max(120)
    .nullable()
    .default(15)
    .meta({ title: "Tiempo para elegir (segundos)" }),
  lives: z.number().int().min(1).max(10).default(3).meta({ title: "Vidas" }),
})

export type BaseSettings = z.infer<typeof baseSettingsSchema>

export const DEFAULT_BASE_SETTINGS: BaseSettings = baseSettingsSchema.parse({})
