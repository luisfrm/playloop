import { z } from "zod"

import { identifier, position } from "./primitives.js"

/**
 * The engine-level container for one piece of content.
 *
 * `payload` is intentionally opaque here: its shape belongs to the `GameType`.
 * The engine validates it with `gameType.contentSchema` — which is why adding a
 * new game type never requires touching this file, the CRUD panel or the DB.
 */
export const contentItemSchema = z.object({
  id: identifier,
  gameInstanceId: identifier,
  position: position.default(0),
  payload: z.unknown(),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
})

export type ContentItem<TPayload = unknown> = {
  id: string
  gameInstanceId: string
  position: number
  payload: TPayload
  createdAt?: number
  updatedAt?: number
}

/** A content item that failed validation, reported back to the panel. */
export type ContentValidationIssue = {
  index: number
  path: string
  message: string
}

/**
 * Validate every payload of a game instance against its game type schema.
 * Returns the parsed payloads, or the list of issues. Never throws.
 */
export function validateContentPayloads<TPayload>(
  schema: z.ZodType<TPayload>,
  payloads: unknown[]
):
  | { ok: true; payloads: TPayload[] }
  | { ok: false; issues: ContentValidationIssue[] } {
  const issues: ContentValidationIssue[] = []
  const parsed: TPayload[] = []

  payloads.forEach((payload, index) => {
    const result = schema.safeParse(payload)
    if (result.success) {
      parsed.push(result.data)
      return
    }
    for (const issue of result.error.issues) {
      issues.push({ index, path: issue.path.join("."), message: issue.message })
    }
  })

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, payloads: parsed }
}
