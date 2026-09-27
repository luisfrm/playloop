import { MemoryRepository, seedDemoInstance } from "@playloop/db"
import {
  baseSettingsSchema,
  gameTypes,
  type ContentItem,
} from "@playloop/game-engine"
import { describe, expect, it } from "vitest"

import { buildRoomRounds } from "@/lib/coop.server"

type BuildInput = Parameters<typeof buildRoomRounds>[0]

async function fixture(count = 3): Promise<BuildInput> {
  const repository = new MemoryRepository()
  const instance = await seedDemoInstance(repository)
  const content = (await repository.listContent(
    instance.id
  )) as unknown as ContentItem<Record<string, unknown>>[]

  return {
    definition: gameTypes.require(
      instance.gameTypeKey
    ) as BuildInput["definition"],
    pool: content,
    settings: baseSettingsSchema.parse({}),
    count,
  }
}

const seeded = () => 0.15

describe("buildRoomRounds", () => {
  it("freezes the requested number of rounds up front", async () => {
    const { rounds } = buildRoomRounds({ ...(await fixture(3)), random: seeded })
    expect(rounds).toHaveLength(3)
  })

  it("gives every round at least two options and an answer among them", async () => {
    const { rounds } = buildRoomRounds({ ...(await fixture(4)), random: seeded })

    for (const round of rounds) {
      expect(round.optionIds.length).toBeGreaterThanOrEqual(2)
      expect(round.optionIds).toContain(round.answerOptionId)
    }
  })

  it("labels every option it publishes", async () => {
    const index = await fixture()
    const { rounds, optionLabels } = buildRoomRounds({
      ...index,
      random: seeded,
    })

    for (const round of rounds) {
      for (const optionId of round.optionIds) {
        expect(optionLabels[optionId]?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })

  it("resolves the answer through the game type, not a guess", async () => {
    const index = await fixture()
    const { rounds } = buildRoomRounds({ ...index, random: seeded })

    // `true_false` shows an item and asks which item it is, so the option whose
    // media matches the prompt is the answer. That is what `resolveAnswer` says
    // too — this asserts the room used it rather than assuming the first option.
    const byMedia = new Map(
      index.pool.map((item) => [String(item.payload["mediaUrl"] ?? ""), item.id])
    )

    for (const round of rounds) {
      expect(byMedia.get(round.prompt.mediaUrl)).toBe(round.answerOptionId)
    }
  })

  it("carries the prompt media so the room can render without the content", async () => {
    const { rounds } = buildRoomRounds({ ...(await fixture()), random: seeded })
    expect(rounds.every((round) => round.prompt.mediaUrl.length > 0)).toBe(true)
  })

  it("keeps serving rounds even when the pool is smaller than the queue", async () => {
    const index = await fixture(10)
    const { rounds } = buildRoomRounds({
      ...index,
      pool: index.pool.slice(0, 2),
      random: seeded,
    })
    expect(rounds.length).toBeGreaterThan(0)
  })
})
