import { z } from "zod"

/**
 * Scalar primitives shared by every entity. Nothing here may name a content
 * domain — these are storage-level shapes, not subject-matter shapes.
 */

export const identifier = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, digits, dash or underscore only")

export const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase kebab-case")

export const label = z.string().trim().min(1).max(160)

export const longText = z.string().trim().max(2000)

export const mediaUrl = z.string().trim().min(1).max(2048)

export const hexOrFunctionalColor = z
  .string()
  .trim()
  .regex(
    /^(#(?:[0-9a-fA-F]{3,8})|(?:oklch|hsl|rgb)a?\([^)]*\))$/,
    "Use a hex colour or a css colour function"
  )

export const position = z.number().int().min(0).max(100_000)

export type Identifier = z.infer<typeof identifier>
