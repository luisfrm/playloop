import { MemoryRepository, seedDemoInstance } from "@playloop/db"
import type { GameInstance } from "@playloop/game-engine"
import { describe, expect, it } from "vitest"

import {
  answerRound,
  expireRound,
  recordScore,
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

async function start(fixture: Fixture, instance: GameInstance | null = null) {
  const view = await startSession({
    repository: fixture.repository,
    store: fixture.store,
    instance: instance ?? fixture.instance,
    playerId: "p1",
    random: () => 0.15,
  })
  return { view, session: await sessionOf(fixture.store, view.sessionId) }
}

function withSettings(
  fixture: Fixture,
  settings: Record<string, unknown>
): GameInstance {
  return {
    ...fixture.instance,
    settings: {
      ...(fixture.instance.settings as Record<string, unknown>),
      ...settings,
    },
  }
}

describe("startSession", () => {
  it("serves the whole board without leaking the targets", async () => {
    const fixture = await setup()
    const { view, session } = await start(fixture)

    expect(view.board).toHaveLength(6)
    expect(view.found).toBe(0)
    expect(view.total).toBe(4)
    expect(view.board.every((chip) => chip.resolved === null)).toBe(true)
    expect(JSON.stringify(view)).not.toContain("trueIds")

    // Frozen server-side: order, targets, nothing resolved yet.
    expect(session.orderedIds).toHaveLength(6)
    expect(session.trueIds).toHaveLength(4)
    expect(session.resolvedIds).toEqual([])
  })

  it("refuses an instance without enough content", async () => {
    const fixture = await setup()
    await fixture.repository.replaceContent(fixture.instance.id, [
      { label: "solo" },
    ])

    await expect(start(fixture)).rejects.toMatchObject({ code: "no_content" })
  })

  it("refuses an instance with nothing to find", async () => {
    const fixture = await setup()
    await fixture.repository.replaceContent(fixture.instance.id, [
      { label: "Uno", isTrue: false },
      { label: "Dos", isTrue: false },
    ])

    await expect(start(fixture)).rejects.toMatchObject({ code: "no_content" })
  })

  it("refuses settings that do not match the game type schema", async () => {
    const fixture = await setup()

    await expect(
      start(fixture, withSettings(fixture, { lives: 99 }))
    ).rejects.toMatchObject({ code: "invalid_settings" })
  })
})

describe("answerRound", () => {
  it("marks a target and scores one point", async () => {
    const fixture = await setup()
    const { view, session } = await start(fixture)
    const target = session.trueIds[0] ?? ""

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: target,
    })

    expect(result.correct).toBe(true)
    expect(result.alreadyResolved).toBe(false)
    expect(result.finished).toBe(false)
    expect(result.view.stats.score).toBe(1)
    expect(result.view.found).toBe(1)
    expect(result.view.board.find((chip) => chip.id === target)?.resolved).toBe(
      "true"
    )
    expect(view.board).toHaveLength(result.view.board.length)
  })

  it("locks a miss and takes a life", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)
    const miss =
      session.orderedIds.find((id) => !session.trueIds.includes(id)) ?? ""

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: miss,
    })

    expect(result.correct).toBe(false)
    expect(result.finished).toBe(false)
    expect(result.view.stats.lives).toBe(2)
    expect(result.view.stats.score).toBe(0)
    expect(result.view.board.find((chip) => chip.id === miss)?.resolved).toBe(
      "false"
    )
  })

  it("ignores a re-pick of a locked cell", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)
    const target = session.trueIds[0] ?? ""
    const answer = {
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: target,
    }

    const first = await answerRound(answer)
    expect(first.correct).toBe(true)

    const stored = await sessionOf(fixture.store, session.id)
    const second = await answerRound({ ...answer, session: stored })

    expect(second.alreadyResolved).toBe(true)
    expect(second.view.stats.score).toBe(1)
    expect(second.view.stats.roundsPlayed).toBe(1)
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
    expect(result.alreadyResolved).toBe(true)
    expect(result.view.stats.score).toBe(0)
    expect(result.view.stats.roundsPlayed).toBe(0)
  })

  it("wins the board with the completion bonus when every target is marked", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)

    let stored = session
    let result = null
    for (const target of session.trueIds) {
      result = await answerRound({
        repository: fixture.repository,
        store: fixture.store,
        session: stored,
        answerId: target,
      })
      stored = await sessionOf(fixture.store, session.id)
    }

    expect(result?.finished).toBe(true)
    // Four targets plus the +2 completion bonus.
    expect(result?.view.stats.score).toBe(6)
    expect(result?.view.stats.status).toBe("won")
    expect(result?.view.found).toBe(4)
  })

  it("ends the session when the last life is lost", async () => {
    const fixture = await setup()
    const { session } = await start(
      fixture,
      withSettings(fixture, { lives: 1 })
    )
    const miss =
      session.orderedIds.find((id) => !session.trueIds.includes(id)) ?? ""

    const result = await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: miss,
    })

    expect(result.finished).toBe(true)
    expect(result.view.stats.status).toBe("lost")
  })
})

describe("expireRound", () => {
  it("loses the whole run when the board clock fires", async () => {
    const fixture = await setup()
    const { session } = await start(fixture)

    const result = await expireRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
    })

    expect(result.correct).toBe(false)
    expect(result.finished).toBe(true)
    expect(result.view.stats.status).toBe("lost")
    expect(result.view.stats.score).toBe(0)
  })
})

describe("recordScore", () => {
  /** Play until the last life is gone, so the session is over and rankable. */
  async function playedOut(
    fixture: Fixture,
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const { session } = await start(
      fixture,
      withSettings(fixture, { lives: 1, ...overrides })
    )
    const miss =
      session.orderedIds.find((id) => !session.trueIds.includes(id)) ?? ""

    await answerRound({
      repository: fixture.repository,
      store: fixture.store,
      session,
      answerId: miss,
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
