import { MemoryRepository } from "@playloop/db"
import { gameTypes } from "@playloop/game-engine"
import { describe, expect, it } from "vitest"

import { ensureGameTypes } from "@/lib/game-types.server"

describe("ensureGameTypes", () => {
  it("mirrors every registered type, so the foreign key can be satisfied", async () => {
    const repository = new MemoryRepository()
    await ensureGameTypes(repository)

    const mirrored = (await repository.listGameTypes())
      .map((type) => type.key)
      .sort()
    const registered = gameTypes.list().map((type) => type.key).sort()

    expect(registered.length).toBeGreaterThan(0)
    expect(mirrored).toEqual(registered)
  })

  it("is idempotent and never moves registeredAt", async () => {
    const repository = new MemoryRepository()
    await ensureGameTypes(repository)
    const first = await repository.listGameTypes()

    await new Promise((resolve) => setTimeout(resolve, 5))
    await ensureGameTypes(repository)
    const second = await repository.listGameTypes()

    expect(second).toEqual(first)
  })

  it("keeps the label in sync with the registry", async () => {
    const repository = new MemoryRepository()
    await repository.saveGameType({
      key: "true_false",
      label: "nombre viejo",
      description: "",
      requiresDictionary: false,
      registeredAt: 1,
    })

    await ensureGameTypes(repository)
    const mirrored = await repository.listGameTypes()
    const type = mirrored.find((entry) => entry.key === "true_false")

    expect(type?.label).toBe(
      gameTypes.list().find((entry) => entry.key === "true_false")?.label
    )
    expect(type?.registeredAt).toBe(1)
  })
})
