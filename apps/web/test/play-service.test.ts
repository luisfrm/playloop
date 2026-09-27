import { MemoryRepository, seedDemoInstance } from "@playloop/db"
import type { GameInstance } from "@playloop/game-engine"
import { describe, expect, it } from "vitest"

import {
  answerRound,
  recordScore,
  serveNextRound,
  startSession,
} from "@/lib/play-service.server"
import { MemorySessionStore, type StoredSession } from "@/lib/sessions.server"

type Fixture = {
  repository: MemoryRepository
  instance: GameInstance
  store: MemorySessionStore
}

async function setup(): Promise<Fixture> {
  const repository = new MemoryRepository()
  const instance = await seedDemoInstance(repository)
  return { repository, instance, store: new MemorySessionStore() }
}

async function sessionOf(
  store: MemorySessionStore,
  id: string
): Promise<StoredSession> {
  const session = await store.get(id)
  if (!session) throw new Error(`missing session ${id}`)
  return session
}

async function start(
  fixture: Fixture,
  requestedMode: "classic" | "expert" = "classic"
) {
  const view = await startSession({
    repository: fixture.repository,
    store: fixture.store,
    instance: fixture.instance,
    playerId: "p1",
    requestedMode,
    random: () => 0.15,
  })
  return { view, session: await sessionOf(fixture.store, view.sessionId) }
}

describe("startSession", () => {
  it("never sends the answer to the client", async () => {
    const fixture = await setup()
    const { view } = await start(fixture)

    // The prompt is media only; its label is the answer and stays server-side.
    expect(view.prompt).not.toHaveProperty("label")
    expect(JSON.stringify(view)).not.toContain("promptId")
    expect(view.options.length).toBeGreaterThanOrEqual(2)
    expect(view.options.every((option) => option.label.length > 0)).toBe(true)
  })

  it("keeps the prompt id on the server only", async () => {
    const fixture = await setup()
    const { view, session } = await start(fixture)

    expect(session.promptId.length).toBeGreaterThan(0)
    expect(view.options.map((option) => option.id)).toContain(session.promptId)
  })

  it("exposes the dictionary only in expert mode", async () => {
    const fixture = await setup()

    const classic = await start(fixture, "classic")
    expect(classic.view.dictionary).toEqual([])

    const expert = await start(fixture, "expert")
    expect(expert.view.answerMode).toBe("expert")
    expect(expert.view.dictionary.length).toBeGreaterThan(0)
  })

  it("refuses expert mode without a dictionary", async () => {
    const fixture = await setup()
    // Expert mode stays gated per instance until it has a loaded dictionary.
    await fixture.repository.replaceDictionary(fixture.instance.id, [])
    const bare: GameInstance = { ...fixture.instance, expertModeEnabled: true }

    await expect(
      startSession({
        repository: fixture.repository,
        store: fixture.store,
        instance: bare,
        playerId: "p1",
        requestedMode: "expert",
      })
    ).rejects.toMatchObject({ code: "expert_unavailable" })
  })

  it("refuses an instance without enough content", async () => {
    const fixture = await setup()
    await fixture.repository.replaceContent(fixture.instance.id, [
      { label: "solo" },
    ])

    await expect(
      startSession({
        repository: fixture.repository,
        store: fixture.store,
        instance: fixture.instance,
        playerId: "p1",
        requestedMode: "classic",
      })
    ).rejects.toMatchObject({ code: "no_content" })
  })

  it("refuses settings that do not match the game type schema", async () => {
    const fixture = await setup()
    const broken: GameInstance = {
      ...fixture.instance,
      settings: { lives: 99 },
    }

    await expect(
      startSession({
        repository: fixture.repository,
        store: fixture.store,
        instance: broken,
        playerId: "p1",
        requestedMode: "classic",
      })
    ).rejects.toMatchObject({ code: "invalid_settings" })
  })
})

describe("answerRound", () => {
  it("accepts the answer the server knows is right", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: session.promptId,
    })

    expect(result.correct).toBe(true)
    expect(result.stats.score).toBe(1)
  })

  it("rejects a wrong option and takes a life", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)
    const wrong = session.optionIds.find((id) => id !== session.promptId) ?? ""

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: wrong,
    })

    expect(result.correct).toBe(false)
    expect(result.stats.lives).toBe(2)
    expect(result.stats.score).toBe(0)
  })

  it("ignores an id the client invented", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: "no-existe",
    })

    expect(result.correct).toBe(false)
  })

  it("reveals the answer only after the submission", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: session.promptId,
    })

    expect(result.revealed.label.length).toBeGreaterThan(0)
    expect(result.revealed.correctOptionId).toBe(session.promptId)
  })

  it("serves a fresh round without repeating the previous prompt", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)

    const answered = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: session.promptId,
    })

    expect(answered.hasNext).toBe(true)
    expect(answered.finished).toBe(false)

    const stored = await sessionOf(fixture.store, session.id)
    const served = await serveNextRound({
      repository: fixture.repository,
      store: fixture.store,
      session: stored,
    })

    expect(served.view).not.toBeNull()
    expect(served.view?.options.map((option) => option.id)).not.toContain(
      session.promptId
    )
  })

  it("starts the next clock only when the round is served", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)

    await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: session.promptId,
    })

    const afterAnswer = await sessionOf(fixture.store, session.id)
    expect(afterAnswer.state.roundStartedAt).toBe(session.state.roundStartedAt)
    expect(afterAnswer.awaitingNext).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 5))
    await serveNextRound({
      repository: fixture.repository,
      store: fixture.store,
      session: afterAnswer,
    })

    const served = await sessionOf(fixture.store, session.id)
    expect(served.state.roundStartedAt).toBeGreaterThan(
      afterAnswer.state.roundStartedAt
    )
    expect(served.awaitingNext).toBe(false)
  })

  it("ends the session when the last life is lost", async () => {
    const fixture = await setup()
    const settings = {
      ...(fixture.instance.settings as Record<string, unknown>),
      lives: 1,
    }

    const view = await startSession({
      repository: fixture.repository,
      store: fixture.store,
      instance: { ...fixture.instance, settings },
      playerId: "p1",
      requestedMode: "classic",
      random: () => 0.15,
    })
    const session = await sessionOf(fixture.store, view.sessionId)
    const wrong = session.optionIds.find((id) => id !== session.promptId) ?? ""

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: wrong,
    })

    expect(result.finished).toBe(true)
    expect(result.stats.status).toBe("lost")
  })

  it("validates expert answers against the dictionary, never free text", async () => {
    const fixture = await setup()
    const { view, session } = await start(fixture, "expert")
    const promptLabel =
      view.options.find((option) => option.id === session.promptId)?.label ?? ""
    const entry = view.dictionary.find(
      (candidate) => candidate.value === promptLabel
    )

    expect(entry).toBeDefined()

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: entry?.id ?? "",
    })

    expect(result.correct).toBe(true)
  })

  it("rejects an expert answer that is not the asked item", async () => {
    const fixture = await setup()
    const { view, session } = await start(fixture, "expert")
    const promptLabel =
      view.options.find((option) => option.id === session.promptId)?.label ?? ""
    const entry = view.dictionary.find(
      (candidate) => candidate.value !== promptLabel
    )

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: entry?.id ?? "",
    })

    expect(result.correct).toBe(false)
  })
})

describe("recordScore", () => {
  /** Play until the last life is gone, so the session is over and rankable. */
  async function playedOut(
    fixture: Fixture,
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const view = await startSession({
      repository: fixture.repository,
      store: fixture.store,
      instance: {
        ...fixture.instance,
        settings: {
          ...(fixture.instance.settings as Record<string, unknown>),
          lives: 1,
          ...overrides,
        },
      },
      playerId: "p1",
      requestedMode: "classic",
      random: () => 0.15,
    })
    const session = await sessionOf(fixture.store, view.sessionId)
    const wrong = session.optionIds.find((id) => id !== session.promptId) ?? ""

    await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: wrong,
    })

    return session.id
  }

  it("is idempotent, so a replayed answer cannot inflate the ranking", async () => {
    const fixture = await setup()
    const sessionId = await playedOut(fixture)

    const first = await recordScore({
      repository: fixture.repository,
      store: fixture.store,
      sessionId,
      finished: true,
    })
    const second = await recordScore({
      repository: fixture.repository,
      store: fixture.store,
      sessionId,
      finished: true,
    })

    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it("never records a mode that does not count for the ranking", async () => {
    const fixture = await setup()
    const sessionId = await playedOut(fixture, { mode: "practice" })

    expect(
      await recordScore({
        repository: fixture.repository,
        store: fixture.store,
        sessionId,
        finished: true,
      })
    ).toBe(false)
  })

  it("ignores a session that has not finished", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)

    expect(
      await recordScore({
        repository: fixture.repository,
        store: fixture.store,
        sessionId: session.id,
        finished: false,
      })
    ).toBe(false)
  })

  it("ignores a session that no longer exists", async () => {
    const fixture = await setup()

    expect(
      await recordScore({
        repository: fixture.repository,
        store: fixture.store,
        sessionId: "no-existe",
        finished: true,
      })
    ).toBe(false)
  })
})
