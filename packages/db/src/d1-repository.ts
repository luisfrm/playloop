import type {
  ContentItem,
  DictionaryEntry,
  GameInstance,
} from "@playloop/game-engine"
import { and, desc, eq, like } from "drizzle-orm"
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1"

import {
  parseJson,
  toContentItem,
  toDictionaryEntry,
  toGameInstance,
  toRankingRow,
} from "./mappers.js"
import type { RankingRow } from "./mappers.js"
import type {
  ContentRepository,
  GameTypeRecord,
  NewDictionaryEntry,
  PlayerRecord,
  ScoreRecord,
} from "./repository.js"
import {
  appSetting,
  blockedTerm,
  contentItem,
  dictionaryEntry,
  gameInstance,
  gameType,
  moderationFlag,
  player,
  scoreEntry,
} from "./schema.js"

export type D1DatabaseLike = Parameters<typeof drizzle>[0]

/**
 * Cloudflare D1 implementation. All writes go through Drizzle so the queries
 * stay typed and the SQL stays reviewable.
 */
export class D1Repository implements ContentRepository {
  private readonly db: DrizzleD1Database

  constructor(database: D1DatabaseLike) {
    this.db = drizzle(database)
  }

  async saveGameType(record: GameTypeRecord): Promise<void> {
    await this.db
      .insert(gameType)
      .values(record)
      .onConflictDoUpdate({
        target: gameType.key,
        // `registeredAt` is deliberately not updated: it records the first time
        // the type appeared, not the last time we looked at it.
        set: {
          label: record.label,
          description: record.description,
          requiresDictionary: record.requiresDictionary,
        },
      })
  }

  async listGameTypes(): Promise<GameTypeRecord[]> {
    const rows = await this.db.select().from(gameType)
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      description: row.description,
      requiresDictionary: row.requiresDictionary,
      registeredAt: row.registeredAt,
    }))
  }

  async listInstances(
    options: { publishedOnly?: boolean } = {}
  ): Promise<GameInstance[]> {
    const query = this.db.select().from(gameInstance)
    const rows = options.publishedOnly
      ? await query.where(eq(gameInstance.published, true))
      : await query
    return rows.map(toGameInstance)
  }

  async getInstanceBySlug(slug: string): Promise<GameInstance | null> {
    const rows = await this.db
      .select()
      .from(gameInstance)
      .where(eq(gameInstance.slug, slug))
      .limit(1)
    const row = rows[0]
    return row ? toGameInstance(row) : null
  }

  async getInstanceById(id: string): Promise<GameInstance | null> {
    const rows = await this.db
      .select()
      .from(gameInstance)
      .where(eq(gameInstance.id, id))
      .limit(1)
    const row = rows[0]
    return row ? toGameInstance(row) : null
  }

  async saveInstance(instance: GameInstance): Promise<void> {
    const now = Date.now()
    const values = {
      id: instance.id,
      slug: instance.slug,
      gameTypeKey: instance.gameTypeKey,
      title: instance.title,
      description: instance.description ?? "",
      themeJson: JSON.stringify(instance.theme),
      settingsJson: JSON.stringify(instance.settings ?? {}),
      published: instance.published,
      expertModeEnabled: instance.expertModeEnabled,
      createdAt: instance.createdAt ?? now,
      updatedAt: now,
    }

    await this.db
      .insert(gameInstance)
      .values(values)
      .onConflictDoUpdate({
        target: gameInstance.id,
        set: { ...values, createdAt: values.createdAt },
      })
  }

  async deleteInstance(id: string): Promise<void> {
    await this.db.delete(contentItem).where(eq(contentItem.gameInstanceId, id))
    await this.db
      .delete(dictionaryEntry)
      .where(eq(dictionaryEntry.gameInstanceId, id))
    await this.db.delete(gameInstance).where(eq(gameInstance.id, id))
  }

  async listContent(gameInstanceId: string): Promise<ContentItem[]> {
    const rows = await this.db
      .select()
      .from(contentItem)
      .where(eq(contentItem.gameInstanceId, gameInstanceId))
      .orderBy(contentItem.position)
    return rows.map((row) => toContentItem(row))
  }

  async replaceContent(
    gameInstanceId: string,
    payloads: unknown[]
  ): Promise<ContentItem[]> {
    const now = Date.now()
    await this.db
      .delete(contentItem)
      .where(eq(contentItem.gameInstanceId, gameInstanceId))

    if (payloads.length === 0) return []

    const values = payloads.map((payload, position) => ({
      id: `${gameInstanceId}-item-${position}-${now.toString(36)}`,
      gameInstanceId,
      position,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      updatedAt: now,
    }))

    await this.db.insert(contentItem).values(values)
    return values.map((value) => ({
      id: value.id,
      gameInstanceId,
      position: value.position,
      payload: payloads[value.position],
      createdAt: now,
      updatedAt: now,
    }))
  }

  async listDictionary(gameInstanceId: string): Promise<DictionaryEntry[]> {
    const rows = await this.db
      .select()
      .from(dictionaryEntry)
      .where(eq(dictionaryEntry.gameInstanceId, gameInstanceId))
    return rows.map(toDictionaryEntry)
  }

  async replaceDictionary(
    gameInstanceId: string,
    entries: NewDictionaryEntry[]
  ): Promise<DictionaryEntry[]> {
    const now = Date.now()
    await this.db
      .delete(dictionaryEntry)
      .where(eq(dictionaryEntry.gameInstanceId, gameInstanceId))

    if (entries.length === 0) return []

    const values = entries.map((entry, index) => ({
      id: `${gameInstanceId}-entry-${index}-${now.toString(36)}`,
      gameInstanceId,
      value: entry.value,
      aliasesJson: JSON.stringify(entry.aliases),
      createdAt: now,
    }))

    await this.db.insert(dictionaryEntry).values(values)
    return values.map((value, index) => ({
      id: value.id,
      gameInstanceId,
      value: value.value,
      aliases: entries[index]?.aliases ?? [],
    }))
  }

  async upsertPlayer(record: PlayerRecord): Promise<void> {
    await this.db
      .insert(player)
      .values(record)
      .onConflictDoUpdate({
        target: player.id,
        set: { displayName: record.displayName, updatedAt: record.updatedAt },
      })
  }

  async getPlayer(id: string): Promise<PlayerRecord | null> {
    const rows = await this.db
      .select()
      .from(player)
      .where(eq(player.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async listPlayersByName(
    query: string,
    limit: number
  ): Promise<PlayerRecord[]> {
    const rows = await this.db
      .select()
      .from(player)
      .where(query ? like(player.displayName, `%${query}%`) : undefined)
      .limit(limit)
    return rows
  }

  async saveScore(score: ScoreRecord): Promise<void> {
    await this.db.insert(scoreEntry).values(score)
  }

  async listRanking(
    gameInstanceId: string,
    limit: number
  ): Promise<RankingRow[]> {
    const rows = await this.db
      .select({
        playerId: scoreEntry.playerId,
        score: scoreEntry.score,
        roundsPlayed: scoreEntry.roundsPlayed,
        bestStreak: scoreEntry.bestStreak,
        createdAt: scoreEntry.createdAt,
        displayName: player.displayName,
        flagId: moderationFlag.id,
      })
      .from(scoreEntry)
      .leftJoin(player, eq(player.id, scoreEntry.playerId))
      .leftJoin(
        moderationFlag,
        and(
          eq(moderationFlag.playerId, scoreEntry.playerId),
          eq(moderationFlag.hidden, true)
        )
      )
      .where(
        and(
          eq(scoreEntry.gameInstanceId, gameInstanceId),
          eq(scoreEntry.ranked, true)
        )
      )
      .orderBy(desc(scoreEntry.score))
      .limit(limit)

    return rows
      .filter((row) => row.flagId === null)
      .map((row) =>
        toRankingRow(
          {
            id: "",
            gameInstanceId,
            playerId: row.playerId,
            score: row.score,
            roundsPlayed: row.roundsPlayed,
            bestStreak: row.bestStreak,
            mode: "solo",
            ranked: true,
            createdAt: row.createdAt,
          },
          row.displayName ?? "Jugador"
        )
      )
  }

  async listBlockedTerms(): Promise<string[]> {
    const rows = await this.db.select().from(blockedTerm)
    return rows.map((row) => row.term)
  }

  async replaceBlockedTerms(terms: string[]): Promise<void> {
    const now = Date.now()
    await this.db.delete(blockedTerm)
    if (terms.length === 0) return
    await this.db.insert(blockedTerm).values(
      terms.map((term, index) => ({
        id: `term-${index}-${now.toString(36)}`,
        term,
        createdAt: now,
      }))
    )
  }

  async setPlayerHidden(
    playerId: string,
    hidden: boolean,
    reason = ""
  ): Promise<void> {
    await this.db
      .delete(moderationFlag)
      .where(eq(moderationFlag.playerId, playerId))
    if (!hidden) return
    await this.db.insert(moderationFlag).values({
      id: `flag-${playerId}`,
      playerId,
      hidden: true,
      reason,
      createdAt: Date.now(),
    })
  }

  async isPlayerHidden(playerId: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(moderationFlag)
      .where(
        and(
          eq(moderationFlag.playerId, playerId),
          eq(moderationFlag.hidden, true)
        )
      )
      .limit(1)
    return rows.length > 0
  }

  async listSettings(): Promise<Record<string, unknown>> {
    const rows = await this.db.select().from(appSetting)
    return Object.fromEntries(
      rows.map((row) => [row.key, parseJson<unknown>(row.valueJson, null)])
    )
  }

  async saveSetting(key: string, value: unknown): Promise<void> {
    const valueJson = JSON.stringify(value ?? null)
    const updatedAt = Date.now()
    await this.db
      .insert(appSetting)
      .values({ key, valueJson, updatedAt })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { valueJson, updatedAt },
      })
  }
}
