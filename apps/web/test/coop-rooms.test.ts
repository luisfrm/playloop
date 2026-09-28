import { MemoryRepository, seedDemoInstance } from "@playloop/db"
import { gameTypes, type BaseSettings } from "@playloop/game-engine"
import { describe, expect, it } from "vitest"

import { buildRoomBoard } from "@/lib/coop.server"

type BoardInput = Parameters<typeof buildRoomBoard>[0]

async function pool() {
  const repository = new MemoryRepository()
  const instance = await seedDemoInstance(repository)
  const definition = gameTypes.require(
    instance.gameTypeKey
  ) as BoardInput["definition"]
  const settings = {
    ...(instance.settings as Record<string, unknown>),
  } as BaseSettings
  const content = (await repository.listContent(
    instance.id
  )) as BoardInput["pool"]
  return { definition, settings, content }
}

const seeded = () => 0.15

describe("buildRoomBoard", () => {
  it("freezes the whole pool into a single board with sealed targets", async () => {
    const { definition, settings, content } = await pool()
    const built = buildRoomBoard({
      definition,
      pool: content,
      settings,
      random: seeded,
    })

    expect(built).not.toBeNull()
    expect(built?.board.optionIds).toHaveLength(6)
    expect(built?.board.correctIds).toHaveLength(4)
    expect(built?.board.foundIds).toEqual([])
    expect(built?.board.falseIds).toEqual([])
  })

  it("labels and illustrates every cell", async () => {
    const { definition, settings, content } = await pool()
    const built = buildRoomBoard({
      definition,
      pool: content,
      settings,
      random: seeded,
    })

    expect(built).not.toBeNull()
    for (const id of built?.board.optionIds ?? []) {
      expect(built?.optionLabels[id]?.length ?? 0).toBeGreaterThan(0)
      expect(built?.optionMedia[id]).toContain("picsum.photos")
    }
  })

  it("returns null when the pool cannot make a board", async () => {
    const { definition, settings } = await pool()
    expect(
      buildRoomBoard({ definition, pool: [], settings, random: seeded })
    ).toBeNull()
  })
})
