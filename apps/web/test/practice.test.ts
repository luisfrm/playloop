import { MemoryRepository, seedDemoInstance } from "@playloop/db"
import { describe, expect, it } from "vitest"

import type { OfflineInstance } from "@/lib/offline"
import {
  answerPractice,
  expirePractice,
  nextPracticeRound,
  practiceView,
  startPractice,
} from "@/lib/practice"

/** Mirrors what `/api/offline/:slug` hands the browser. */
async function downloaded(fillDictionary = true): Promise<OfflineInstance> {
  const repository = new MemoryRepository()
  const instance = await seedDemoInstance(repository)
  if (!fillDictionary) {
    await repository.replaceDictionary(instance.id, [])
  }

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
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    expect(state).not.toBeNull()
    expect(state?.settings.mode).toBe("practice")
    expect(state?.session.mode).toBe("practice")
    expect(state?.finished).toBe(false)
  })

  it("never sends the answer to the client", async () => {
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    const view = practiceView(state!)
    expect(view).not.toBeNull()
    if (!view) return

    // The prompt id is a server-side detail: it only ever appears as one of the
    // options, never as a labelled field the client could read off.
    expect(JSON.stringify(view)).not.toContain("promptId")
    expect(view.options.some((option) => option.id === state?.promptId)).toBe(
      true
    )
  })

  it("refuses to start without enough content", async () => {
    const instance = await downloaded()
    const tiny: OfflineInstance = {
      ...instance,
      content: instance.content.slice(0, 1),
    }
    expect(startPractice(tiny, "classic", seeded, 1_000)).toBeNull()
  })

  it("falls back to classic when there is no dictionary", async () => {
    const state = startPractice(
      await downloaded(false),
      "expert",
      seeded,
      1_000
    )
    expect(state?.answerMode).toBe("classic")
    expect(state?.dictionary).toEqual([])
  })

  it("exposes the dictionary in expert mode", async () => {
    const state = startPractice(await downloaded(), "expert", seeded, 1_000)
    expect(state?.answerMode).toBe("expert")
    expect((state?.dictionary.length ?? 0) > 0).toBe(true)
    expect((practiceView(state!)?.dictionary.length ?? 0) > 0).toBe(true)
  })
})

describe("answerPractice", () => {
  it("scores the option the prompt actually is", async () => {
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const outcome = answerPractice(state, state.promptId, 2_000)
    expect(outcome.correct).toBe(true)
    expect(outcome.state.session.score).toBe(1)
    expect(outcome.state.finished).toBe(false)
  })

  it("takes a life for a wrong option", async () => {
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const wrong = state.optionIds.find((id) => id !== state.promptId) ?? ""
    const outcome = answerPractice(state, wrong, 2_000)

    expect(outcome.correct).toBe(false)
    expect(outcome.state.session.lives).toBe(2)
  })

  it("ignores an option the client invented", async () => {
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    if (!state) throw new Error("expected a session")

    expect(answerPractice(state, "no-existe", 2_000).correct).toBe(false)
  })

  it("ends the session on the last life", async () => {
    const instance = await downloaded()
    const state = startPractice(
      {
        ...instance,
        settings: { ...(instance.settings as object), lives: 1 },
      },
      "classic",
      seeded,
      1_000
    )
    if (!state) throw new Error("expected a session")

    const wrong = state.optionIds.find((id) => id !== state.promptId) ?? ""
    const outcome = answerPractice(state, wrong, 2_000)

    expect(outcome.state.finished).toBe(true)
    expect(outcome.state.session.status).toBe("lost")
  })

  it("resolves expert answers against the dictionary", async () => {
    const state = startPractice(await downloaded(), "expert", seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const view = practiceView(state)
    const label = view?.options.find(
      (option) => option.id === state.promptId
    )?.label
    const entry = state.dictionary.find((candidate) => candidate.value === label)

    expect(entry).toBeDefined()
    expect(answerPractice(state, entry?.id ?? "", 2_000).correct).toBe(true)
  })
})

describe("expirePractice", () => {
  it("loses the round without an answer", async () => {
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const outcome = expirePractice(state, 2_000)
    expect(outcome.correct).toBe(false)
    expect(outcome.state.session.lives).toBe(2)
    expect(outcome.revealedLabel.length).toBeGreaterThan(0)
  })
})

describe("nextPracticeRound", () => {
  it("restarts the selection clock when the round is served", async () => {
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const answered = answerPractice(state, state.promptId, 2_000)
    const next = nextPracticeRound(answered.state, seeded, 5_000)

    expect(next).not.toBeNull()
    // The clock follows the player's pace, not the moment they answered.
    expect(next?.session.roundStartedAt).toBe(5_000)
    expect(practiceView(next!)?.selectionDeadlineMs).toBe(
      5_000 + (next?.settings.selectionTimeLimitSeconds ?? 0) * 1000
    )
  })

  it("keeps serving rounds and moves on from the answered one", async () => {
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    if (!state) throw new Error("expected a session")

    const answered = answerPractice(state, state.promptId, 2_000)
    const next = nextPracticeRound(answered.state, seeded, 5_000)

    expect(next?.askedIds).toContain(state.promptId)
    expect(next?.askedIds.length).toBe(state.askedIds.length + 1)
  })

  it("refuses once the session is over", async () => {
    const state = startPractice(await downloaded(), "classic", seeded, 1_000)
    if (!state) throw new Error("expected a session")

    expect(nextPracticeRound({ ...state, finished: true })).toBeNull()
  })
})
