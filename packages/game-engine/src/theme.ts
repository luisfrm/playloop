import { z } from "zod"

import { hexOrFunctionalColor, label, longText } from "./primitives.js"

/**
 * A `Theme` is data, never a hardcoded category. Each game instance carries its
 * own theme so the same engine can ship many looking products.
 */
export const themeSchema = z.object({
  name: label,
  description: longText.optional(),
  colors: z
    .object({
      primary: hexOrFunctionalColor,
      accent: hexOrFunctionalColor,
      surface: hexOrFunctionalColor,
      ink: hexOrFunctionalColor,
    })
    .partial()
    .default({}),
  texts: z
    .object({
      headline: label.optional(),
      subheadline: longText.optional(),
      primaryAction: label.optional(),
    })
    .default({}),
})

export type Theme = z.infer<typeof themeSchema>
export const DEFAULT_THEME_NAME = "Tema por defecto"

export const emptyTheme = (): Theme =>
  themeSchema.parse({ name: DEFAULT_THEME_NAME })
