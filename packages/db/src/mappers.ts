import type {
  ContentItem,
  DictionaryEntry,
  GameInstance,
  Theme,
} from "@playloop/game-engine"
import { themeSchema } from "@playloop/game-engine"

import type {
  contentItem as contentItemTable,
  dictionaryEntry as dictionaryEntryTable,
  gameInstance as gameInstanceTable,
  scoreEntry as scoreEntryTable,
} from "./schema.js"

type GameInstanceRow = typeof gameInstanceTable.$inferSelect
type ContentItemRow = typeof contentItemTable.$inferSelect
type DictionaryEntryRow = typeof dictionaryEntryTable.$inferSelect
type ScoreEntryRow = typeof scoreEntryTable.$inferSelect

/** Never trust serialised JSON from storage: fall back to a safe default. */
export function parseTheme(themeJson: string): Theme {
  try {
    return themeSchema.parse(JSON.parse(themeJson))
  } catch {
    return themeSchema.parse({ name: "Tema por defecto" })
  }
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function toGameInstance(row: GameInstanceRow): GameInstance {
  return {
    id: row.id,
    slug: row.slug,
    gameTypeKey: row.gameTypeKey,
    title: row.title,
    description: row.description,
    theme: parseTheme(row.themeJson),
    settings: parseJson<unknown>(row.settingsJson, {}),
    published: row.published,
    expertModeEnabled: row.expertModeEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toContentItem<TPayload = unknown>(
  row: ContentItemRow
): ContentItem<TPayload> {
  return {
    id: row.id,
    gameInstanceId: row.gameInstanceId,
    position: row.position,
    payload: parseJson<TPayload>(row.payloadJson, {} as TPayload),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toDictionaryEntry(row: DictionaryEntryRow): DictionaryEntry {
  return {
    id: row.id,
    gameInstanceId: row.gameInstanceId,
    value: row.value,
    aliases: parseJson<string[]>(row.aliasesJson, []),
  }
}

export type RankingRow = {
  playerId: string
  displayName: string
  score: number
  roundsPlayed: number
  bestStreak: number
  createdAt: number
  hidden: boolean
}

export function toRankingRow(
  score: ScoreEntryRow,
  displayName: string,
  hidden = false
): RankingRow {
  return {
    playerId: score.playerId,
    displayName,
    score: score.score,
    roundsPlayed: score.roundsPlayed,
    bestStreak: score.bestStreak,
    createdAt: score.createdAt,
    hidden,
  }
}
