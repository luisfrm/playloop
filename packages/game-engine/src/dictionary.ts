import { z } from "zod"

import { identifier, label } from "./primitives.js"

/**
 * The curated universe of valid answers for one game instance.
 *
 * Independent from `ContentItem`: the content defines *what is asked*, the
 * dictionary defines *what can be answered*. Expert mode is disabled for an
 * instance until this list is non-empty.
 */
export const dictionaryEntrySchema = z.object({
  id: identifier,
  gameInstanceId: identifier,
  value: label,
  aliases: z.array(label).max(20).default([]),
})

export type DictionaryEntry = z.infer<typeof dictionaryEntrySchema>

/** Expert mode gate: an instance cannot run expert mode without a dictionary. */
export function isDictionaryUsable(
  entries: readonly DictionaryEntry[]
): boolean {
  return entries.length > 0
}

/** Normalise a value so dictionary matching never depends on typos or accents. */
export function normalizeValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Every surface form of a dictionary entry, normalised. */
export function entryLookupKeys(entry: DictionaryEntry): string[] {
  return [entry.value, ...entry.aliases].map(normalizeValue)
}

/**
 * Parse a dictionary payload from a CSV-ish text block: one entry per line,
 * `value` plus optional `|`-separated aliases. Keeps the panel free of any
 * game-type knowledge.
 */
export function parseDictionaryText(
  text: string
): { value: string; aliases: string[] }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const [value = "", ...aliases] = line
        .split("|")
        .map((part) => part.trim())
      return { value, aliases: aliases.filter((alias) => alias.length > 0) }
    })
    .filter((entry) => entry.value.length > 0)
}
