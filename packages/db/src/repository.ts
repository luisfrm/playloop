import type {
  ContentItem,
  DictionaryEntry,
  GameInstance,
} from "@playloop/game-engine"

import type { RankingRow } from "./mappers.js"

export type PlayerRecord = {
  id: string
  displayName: string
  createdAt: number
  updatedAt: number
}

export type ScoreRecord = {
  id: string
  gameInstanceId: string
  playerId: string
  score: number
  roundsPlayed: number
  bestStreak: number
  mode: string
  /** Only server-verified, ranked attempts are stored with true. */
  ranked: boolean
  createdAt: number
}

export type NewDictionaryEntry = { value: string; aliases: string[] }

/**
 * A row of the `game_type` mirror. The code registry is the source of truth;
 * this table exists so `game_instance` can reference a known type.
 */
export type GameTypeRecord = {
  key: string
  label: string
  description: string
  requiresDictionary: boolean
  registeredAt: number
}

/**
 * Everything the app needs from storage. Two implementations exist: Cloudflare
 * D1 in production, in-memory for tests and local dev without a binding. The
 * routes never import Drizzle directly, so swapping storage never touches UI.
 */
export interface ContentRepository {
  /**
   * Mirror one registered game type. Idempotent, and it never rewrites
   * `registeredAt`: an existing row keeps the moment it first appeared.
   */
  saveGameType(type: GameTypeRecord): Promise<void>
  listGameTypes(): Promise<GameTypeRecord[]>

  listInstances(options?: { publishedOnly?: boolean }): Promise<GameInstance[]>
  getInstanceBySlug(slug: string): Promise<GameInstance | null>
  getInstanceById(id: string): Promise<GameInstance | null>
  saveInstance(instance: GameInstance): Promise<void>
  deleteInstance(id: string): Promise<void>

  listContent(gameInstanceId: string): Promise<ContentItem[]>
  replaceContent(
    gameInstanceId: string,
    payloads: unknown[]
  ): Promise<ContentItem[]>

  listDictionary(gameInstanceId: string): Promise<DictionaryEntry[]>
  replaceDictionary(
    gameInstanceId: string,
    entries: NewDictionaryEntry[]
  ): Promise<DictionaryEntry[]>

  upsertPlayer(player: PlayerRecord): Promise<void>
  getPlayer(id: string): Promise<PlayerRecord | null>
  listPlayersByName(query: string, limit: number): Promise<PlayerRecord[]>

  saveScore(score: ScoreRecord): Promise<void>
  /** The ranking is always scoped to one game instance, never global. */
  listRanking(gameInstanceId: string, limit: number): Promise<RankingRow[]>

  listBlockedTerms(): Promise<string[]>
  replaceBlockedTerms(terms: string[]): Promise<void>
  setPlayerHidden(
    playerId: string,
    hidden: boolean,
    reason?: string
  ): Promise<void>
  isPlayerHidden(playerId: string): Promise<boolean>

  /** Panel-owned runtime settings, keyed by name. Values are opaque JSON. */
  listSettings(): Promise<Record<string, unknown>>
  saveSetting(key: string, value: unknown): Promise<void>
}
