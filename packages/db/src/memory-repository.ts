import type {
  ContentItem,
  DictionaryEntry,
  GameInstance,
} from "@playloop/game-engine"

import type { RankingRow } from "./mappers.js"
import type {
  ContentRepository,
  GameTypeRecord,
  NewDictionaryEntry,
  PlayerRecord,
  ScoreRecord,
} from "./repository.js"

/**
 * In-memory store. Used by tests and by local dev when no D1 binding is
 * available, so the whole app is runnable with `pnpm dev` and zero setup.
 */
export class MemoryRepository implements ContentRepository {
  private gameTypes = new Map<string, GameTypeRecord>()
  private instances = new Map<string, GameInstance>()
  private content = new Map<string, ContentItem[]>()
  private dictionary = new Map<string, DictionaryEntry[]>()
  private players = new Map<string, PlayerRecord>()
  private scores: ScoreRecord[] = []
  private blocked = new Set<string>()
  private hidden = new Set<string>()
  private sequence = 0

  private nextId(prefix: string): string {
    this.sequence += 1
    return `${prefix}_${this.sequence.toString(36)}`
  }

  async saveGameType(type: GameTypeRecord): Promise<void> {
    const existing = this.gameTypes.get(type.key)
    this.gameTypes.set(type.key, {
      ...type,
      registeredAt: existing?.registeredAt ?? type.registeredAt,
    })
  }

  async listGameTypes(): Promise<GameTypeRecord[]> {
    return [...this.gameTypes.values()]
  }

  async listInstances(
    options: { publishedOnly?: boolean } = {}
  ): Promise<GameInstance[]> {
    const all = [...this.instances.values()]
    const filtered = options.publishedOnly
      ? all.filter((item) => item.published)
      : all
    return filtered.sort((a, b) => a.title.localeCompare(b.title))
  }

  async getInstanceBySlug(slug: string): Promise<GameInstance | null> {
    return (
      [...this.instances.values()].find((item) => item.slug === slug) ?? null
    )
  }

  async getInstanceById(id: string): Promise<GameInstance | null> {
    return this.instances.get(id) ?? null
  }

  async saveInstance(instance: GameInstance): Promise<void> {
    this.instances.set(instance.id, instance)
  }

  async deleteInstance(id: string): Promise<void> {
    this.instances.delete(id)
    this.content.delete(id)
    this.dictionary.delete(id)
  }

  async listContent(gameInstanceId: string): Promise<ContentItem[]> {
    return [...(this.content.get(gameInstanceId) ?? [])].sort(
      (a, b) => a.position - b.position
    )
  }

  async replaceContent(
    gameInstanceId: string,
    payloads: unknown[]
  ): Promise<ContentItem[]> {
    const now = Date.now()
    const items = payloads.map<ContentItem>((payload, position) => ({
      id: this.nextId("item"),
      gameInstanceId,
      position,
      payload,
      createdAt: now,
      updatedAt: now,
    }))
    this.content.set(gameInstanceId, items)
    return items
  }

  async listDictionary(gameInstanceId: string): Promise<DictionaryEntry[]> {
    return [...(this.dictionary.get(gameInstanceId) ?? [])]
  }

  async replaceDictionary(
    gameInstanceId: string,
    entries: NewDictionaryEntry[]
  ): Promise<DictionaryEntry[]> {
    const parsed = entries.map<DictionaryEntry>((entry) => ({
      id: this.nextId("entry"),
      gameInstanceId,
      value: entry.value,
      aliases: entry.aliases,
    }))
    this.dictionary.set(gameInstanceId, parsed)
    return parsed
  }

  async upsertPlayer(player: PlayerRecord): Promise<void> {
    this.players.set(player.id, player)
  }

  async getPlayer(id: string): Promise<PlayerRecord | null> {
    return this.players.get(id) ?? null
  }

  async listPlayersByName(
    query: string,
    limit: number
  ): Promise<PlayerRecord[]> {
    const needle = query.trim().toLowerCase()
    return [...this.players.values()]
      .filter((player) =>
        needle ? player.displayName.toLowerCase().includes(needle) : true
      )
      .slice(0, limit)
  }

  async saveScore(score: ScoreRecord): Promise<void> {
    this.scores.push(score)
  }

  async listRanking(
    gameInstanceId: string,
    limit: number
  ): Promise<RankingRow[]> {
    const best = new Map<string, ScoreRecord>()
    for (const score of this.scores) {
      if (score.gameInstanceId !== gameInstanceId || !score.ranked) continue
      const current = best.get(score.playerId)
      if (!current || score.score > current.score)
        best.set(score.playerId, score)
    }

    return [...best.values()]
      .map<RankingRow>((score) => ({
        playerId: score.playerId,
        displayName: this.players.get(score.playerId)?.displayName ?? "Jugador",
        score: score.score,
        roundsPlayed: score.roundsPlayed,
        bestStreak: score.bestStreak,
        createdAt: score.createdAt,
        hidden: this.hidden.has(score.playerId),
      }))
      .filter((row) => !row.hidden)
      .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
      .slice(0, limit)
  }

  async listBlockedTerms(): Promise<string[]> {
    return [...this.blocked]
  }

  async replaceBlockedTerms(terms: string[]): Promise<void> {
    this.blocked = new Set(terms.map((term) => term.trim()).filter(Boolean))
  }

  async setPlayerHidden(
    playerId: string,
    hidden: boolean,
    _reason?: string
  ): Promise<void> {
    if (hidden) this.hidden.add(playerId)
    else this.hidden.delete(playerId)
  }

  async isPlayerHidden(playerId: string): Promise<boolean> {
    return this.hidden.has(playerId)
  }
}

/**
 * Demo seed. Deliberately fictitious and generic — the real theme is loaded
 * later, as data, through the panel.
 */
export async function seedDemoInstance(
  repository: ContentRepository
): Promise<GameInstance> {
  const now = Date.now()
  const instance: GameInstance = {
    id: "demo_instance",
    slug: "tema-de-prueba",
    gameTypeKey: "true_false",
    title: "Tema de prueba",
    description: "Instancia de demostración con contenido ficticio.",
    theme: { name: "Tema de prueba", colors: {}, texts: {} },
    settings: { mode: "solo", answerMode: "classic", lives: 3, optionCount: 4 },
    published: true,
    expertModeEnabled: true,
    createdAt: now,
    updatedAt: now,
  }
  await repository.saveInstance(instance)
  await repository.replaceContent(
    instance.id,
    [1, 2, 3, 4, 5, 6].map((index) => ({
      label: `Elemento ${index}`,
      mediaUrl: `https://picsum.photos/seed/playloop-${index}/800/500`,
      description: `Descripción de prueba ${index}.`,
      isCorrectPool: true,
    }))
  )
  await repository.replaceDictionary(
    instance.id,
    [1, 2, 3, 4, 5, 6].map((index) => ({
      value: `Elemento ${index}`,
      aliases: [`E${index}`],
    }))
  )
  return instance
}

export function createSeededMemoryRepository(): MemoryRepository {
  const repository = new MemoryRepository()
  // Seed synchronously so loaders never render an empty home in dev.
  void seedDemoInstance(repository)
  return repository
}
