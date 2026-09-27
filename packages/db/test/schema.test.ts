import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core"
import { describe, expect, it } from "vitest"

import {
  createSeededMemoryRepository,
  MemoryRepository,
} from "../src/memory-repository.js"
import { parseJson, parseTheme } from "../src/mappers.js"
import * as schema from "../src/schema.js"

const FORBIDDEN = [
  "futbol",
  "fútbol",
  "football",
  "soccer",
  "estadio",
  "stadium",
  "kpop",
  "balon",
]
const FORBIDDEN_PATTERN = new RegExp(`\\b(${FORBIDDEN.join("|")})\\b`, "i")

describe("schema abstraction", () => {
  it("names no content domain in any table or column", () => {
    const tables = Object.values(schema) as SQLiteTable[]

    const text = tables
      .map((table) => {
        const config = getTableConfig(table)
        return `${config.name} ${config.columns.map((column) => column.name).join(",")}`
      })
      .join("\n")
      .toLowerCase()

    expect(tables.length).toBeGreaterThanOrEqual(10)
    expect(text).toContain("game_instance")
    expect(FORBIDDEN_PATTERN.test(text)).toBe(false)
  })

  it("ships a migration that creates every table", () => {
    const sql = readFileSync(
      fileURLToPath(new URL("../migrations/0000_init.sql", import.meta.url)),
      "utf8"
    ).toLowerCase()

    for (const table of [
      "game_type",
      "game_instance",
      "content_item",
      "dictionary_entry",
      "player",
      "account",
      "score_entry",
      "blocked_term",
      "moderation_flag",
      "app_setting",
    ]) {
      expect(sql).toContain(`create table if not exists ${table}`)
    }
  })

  it("indexes the leaderboard per instance", () => {
    const sql = readFileSync(
      fileURLToPath(new URL("../migrations/0000_init.sql", import.meta.url)),
      "utf8"
    )
    expect(sql).toContain("score_entry(game_instance_id, ranked, score DESC)")
  })
})

describe("mappers", () => {
  it("falls back to a safe theme when storage holds garbage", () => {
    expect(parseTheme("{not json").name).toBe("Tema por defecto")
  })

  it("parses valid JSON and falls back otherwise", () => {
    expect(parseJson<string[]>("[1]", [])).toEqual([1])
    expect(parseJson<string[]>("nope", ["fallback"])).toEqual(["fallback"])
  })
})

describe("MemoryRepository", () => {
  it("stores and reads back an instance", async () => {
    const repo = new MemoryRepository()
    const seeded = await createSeededMemoryRepository().listInstances()
    const instance = seeded[0]!

    await repo.saveInstance(instance)
    expect(await repo.getInstanceBySlug(instance.slug)).toMatchObject({
      id: instance.id,
    })
  })

  it("replaces content atomically and keeps positions", async () => {
    const repo = new MemoryRepository()
    await repo.replaceContent("i", [{ a: 1 }, { a: 2 }])
    const items = await repo.listContent("i")
    expect(items.map((item) => item.position)).toEqual([0, 1])
    expect(items[0]?.payload).toEqual({ a: 1 })
  })

  it("keeps the best score per player and hides flagged players", async () => {
    const repo = new MemoryRepository()
    const now = Date.now()
    await repo.upsertPlayer({
      id: "p1",
      displayName: "Ana",
      createdAt: now,
      updatedAt: now,
    })
    await repo.upsertPlayer({
      id: "p2",
      displayName: "Beto",
      createdAt: now,
      updatedAt: now,
    })

    const base = {
      gameInstanceId: "i",
      roundsPlayed: 5,
      bestStreak: 2,
      mode: "solo",
      ranked: true,
    }
    await repo.saveScore({
      ...base,
      id: "s1",
      playerId: "p1",
      score: 3,
      createdAt: 1,
    })
    await repo.saveScore({
      ...base,
      id: "s2",
      playerId: "p1",
      score: 7,
      createdAt: 2,
    })
    await repo.saveScore({
      ...base,
      id: "s3",
      playerId: "p2",
      score: 5,
      createdAt: 3,
    })
    await repo.saveScore({
      ...base,
      id: "s4",
      playerId: "p2",
      score: 99,
      ranked: false,
      createdAt: 4,
    })

    const ranking = await repo.listRanking("i", 10)
    expect(ranking.map((row) => [row.displayName, row.score])).toEqual([
      ["Ana", 7],
      ["Beto", 5],
    ])

    await repo.setPlayerHidden("p1", true)
    expect(
      (await repo.listRanking("i", 10)).map((row) => row.displayName)
    ).toEqual(["Beto"])
  })

  it("never mixes rankings across instances", async () => {
    const repo = new MemoryRepository()
    const now = Date.now()
    await repo.upsertPlayer({
      id: "p1",
      displayName: "Ana",
      createdAt: now,
      updatedAt: now,
    })
    await repo.saveScore({
      id: "s1",
      gameInstanceId: "other",
      playerId: "p1",
      score: 9,
      roundsPlayed: 1,
      bestStreak: 1,
      mode: "solo",
      ranked: true,
      createdAt: 1,
    })
    expect(await repo.listRanking("i", 10)).toEqual([])
  })
})

describe("demo seed", () => {
  it("uses obviously fictitious, generic data", async () => {
    const [instance] = await createSeededMemoryRepository().listInstances()
    expect(instance?.title).toBe("Tema de prueba")
    expect(instance?.slug).toBe("tema-de-prueba")
  })
})
