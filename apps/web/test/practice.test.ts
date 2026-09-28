import { MemoryRepository, seedDemoInstance } from "@playloop/db"
import { describe, expect, it } from "vitest"

import type { OfflineInstance } from "@/lib/offline"
import {
  answerPractice,
  expirePractice,
  practiceView,
  startPractice,
} from "@/lib/practice"

/** Mirrors what `/api/offline/:slug` hands the browser. */
async function downloaded(): Promise<OfflineInstance> {
  const repository = new MemoryRepository()
  const instance = await seedDemoInstance(repository)

  const [content, dictionary] = await Promise.all([
    repository.listContent(instance.id),
    repository.listDictionary(instance.id),
  ])

  return {
    instanceId: instance.id,
    slug: instance.slug,
    title: instance.title,
    description: instance.description ?? "",
    gameTypeKey: instance.gameTypeKey,
    settings: instance.settings,
    content: content.map((item) => ({ id: item.id, payload: item.payload })),
    dictionary: dictionary.map((entry) => ({
      id: entry.id,
      gameInstanceId: entry.gameInstanceId,
      value: entry.value,
      aliases: entry.aliases,
    })),
    mediaUrls: [],
    downloadedAt: 1_000,
  }
}

const seeded = () => 0.15

describe("startPractice", () => {
  it("forces practice mode so an offline score can never rank", async () => {
    const state = startPractice(await downloaded(), seeded, 1_000)
    expect(state).not.toBeNull()
    expect(state?.settings.mode).toBe("practice")
    expect(state?.session.mode).toBe("practice")
    expect(state?.finished).toBe(false)
  })

  it("freezes the board without leaking the targets", async () => {
    const state = startPractice(await downloaded(), seeded, 1_000)
    const view = practiceView(state!)
    expect(view).not.toBeNull()
    if (!view || !state) return

    expect(view.board).toHaveLength(6)
    expect(view.total).toBe(4)
    expect(view.found).toBe(0)
    expect(JSON.stringify(view)).not.toContain("trueIds")
    expect(state.trueIds).toHaveLength(4)
    expect(state.resolvedIds).toEqual([])
  })

  it("refuses to start without enough content", async () => {
    const instance = await downloaded()
    const tiny: OfflineInstance = {
      ...instance,
      content: instance.content.slice(0, 1),
    }
    expect(startPractice(tiny, seeded, 1_000)).toBeNull()
  })

  it("refuses to start with nothing to find", async () => {
    const instance = await downloaded()
    const hopeless: OfflineInstance = {
      ...instance,
      content: instance.content.map((item) => ({
        ...item,
        payload: { ...(item.payload as object), isTrue: false },
      })),
    }
    expect(startPractice(hopeless, seeded, 1_000)).toBeNull()
  })
})

describe("answerPractice", () => {
  it("marks a target and scores one point", async () => {
    const state = startPractice(await downloaded(), seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const outcome = answerPractice(state, state.trueIds[0] ?? "", 2_000)
    expect(outcome.correct).toBe(true)
    expect(outcome.alreadyResolved).toBe(false)
    expect(outcome.state.session.score).toBe(1)
    expect(outcome.state.finished).toBe(false)
  })

  it("takes a life for a miss", async () => {
    const state = startPractice(await downloaded(), seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const miss =
      state.orderedIds.find((id) => !state.trueIds.includes(id)) ?? ""
    const outcome = answerPractice(state, miss, 2_000)

    expect(outcome.correct).toBe(false)
    expect(outcome.state.session.lives).toBe(2)
  })

  it("ignores a re-pick of a locked cell", async () => {
    const state = startPractice(await downloaded(), seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const target = state.trueIds[0] ?? ""
    const first = answerPractice(state, target, 2_000)
    const second = answerPractice(first.state, target, 3_000)

    expect(second.alreadyResolved).toBe(true)
    expect(second.state.session.score).toBe(1)
    expect(second.state.session.roundsPlayed).toBe(1)
  })

  it("wins the board with the completion bonus", async () => {
    const embryo = startPractice(await downloaded(), seeded, 1_000)
    if (!embryo) throw new Error("expected a session")

    let state = embryo
    let outcome = null
    for (const target of embryo.trueIds) {
      outcome = answerPractice(state, target, 2_000)
      state = outcome.state
    }

    expect(outcome).not.toBeNull()
    expect(state.finished).toBe(true)
    expect(state.session.status).toBe("won")
    // Four targets plus the +2 completion bonus.
    expect(state.session.score).toBe(6)
  })

  it("ends the session on the last life", async () => {
    const instance = await downloaded()
    const state = startPractice(
      {
        ...instance,
        settings: { ...(instance.settings as object), lives: 1 },
      },
      seeded,
      1_000
    )
    if (!state) throw new Error("expected a session")

    const miss =
      state.orderedIds.find((id) => !state.trueIds.includes(id)) ?? ""
    const outcome = answerPractice(state, miss, 2_000)

    expect(outcome.state.finished).toBe(true)
    expect(outcome.state.session.status).toBe("lost")
  })
})

describe("expirePractice", () => {
  it("loses the whole run when the board clock fires", async () => {
    const state = startPractice(await downloaded(), seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const outcome = expirePractice(state, 2_000)
    expect(outcome.correct).toBe(false)
    expect(outcome.state.finished).toBe(true)
    expect(outcome.state.session.status).toBe("lost")
  })
})
