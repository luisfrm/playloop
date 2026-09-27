import { z } from "zod"

import { identifier, label, longText, slug } from "./primitives.js"
import { themeSchema } from "./theme.js"

/**
 * One playable product. It owns its theme, its content, its settings and its
 * dictionary. Nothing here implies a subject matter — the same entity backs
 * every game the panel ever creates.
 */
export const gameInstanceSchema = z.object({
  id: identifier,
  slug,
  gameTypeKey: identifier,
  title: label,
  description: longText.optional(),
  theme: themeSchema,
  /** Validated against the game type's settings schema, not here. */
  settings: z.unknown(),
  published: z.boolean().default(false),
  /** Expert mode stays off until the instance has dictionary entries. */
  expertModeEnabled: z.boolean().default(false),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
})

export type GameInstance = Omit<
  z.infer<typeof gameInstanceSchema>,
  "settings"
> & {
  settings: unknown
}

export type GameInstanceSummary = {
  id: string
  slug: string
  gameTypeKey: string
  title: string
  description?: string
  theme: z.infer<typeof themeSchema>
  published: boolean
}
