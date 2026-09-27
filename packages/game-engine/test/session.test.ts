import { describe, expect, it } from "vitest"

import { baseSettingsSchema } from "../src/settings.js"
import {
  beginRound,
  countsForRanking,
  createSession,
  expireQuestion,
  finishSession,
  hasTimedOut,
  questionDeadline,
  selectionDeadline,
  submitAnswer,
  totalTimeDeadline,
} from "../src/play/session.js"

const settings = baseSettingsSchema.parse({
  lives: 2,
  questionTimeLimitSeconds: 30,
  selectionTimeLimitSeconds: 15,
  totalTimeLimitSeconds: 120,
})

const fresh = () =>
  createSession({
    sessionId: "s1",
    gameInstanceId: "inst",
    playerId: "p1",
    settings,
    now: 1_000,
  })

const right = { correct: true, askedContentItemId: "a" }
const wrong = { correct: false, askedContentItemId: "b" }

describe("createSession", () => {
  it("starts with zero score and the configured lives", () => {
    const state = fresh()
    expect(state.score).toBe(0)
    expect(state.lives).toBe(2)
    expect(state.status).toBe("running")
  })
})

describe("submitAnswer", () => {
  it("scores one point per correct answer", () => {
    const { state, correct } = submitAnswer(fresh(), settings, right, 2_000)
    expect(correct).toBe(true)
    expect(state.score).toBe(1)
    expect(state.streak).toBe(1)
    expect(state.roundsPlayed).toBe(1)
  })

  it("loses a life and resets the streak on a wrong answer", () => {
    const first = submitAnswer(fresh(), settings, right, 2_000).state
    const { state } = submitAnswer(first, settings, wrong, 3_000)
    expect(state.score).toBe(1)
    expect(state.lives).toBe(1)
    expect(state.streak).toBe(0)
  })

  it("ends the session when the last life is lost", () => {
    const a = submitAnswer(fresh(), settings, wrong, 2_000).state
    const b = submitAnswer(a, settings, wrong, 3_000)
    expect(b.state.lives).toBe(0)
    expect(b.state.status).toBe("lost")
  })

  it("ignores submissions after the session is over", () => {
    const lost = submitAnswer(
      submitAnswer(fresh(), settings, wrong, 2_000).state,
      settings,
      wrong,
      3_000
    )
    const after = submitAnswer(lost.state, settings, right, 4_000)
    expect(after.rejectedReason).toBe("session_finished")
    expect(after.state.score).toBe(0)
  })

  it("expires the session past the total time limit", () => {
    const late = submitAnswer(fresh(), settings, right, 1_000 + 120_000 + 1)
    expect(late.rejectedReason).toBe("total_time_exceeded")
    expect(late.state.status).toBe("expired")
  })

  it("stamps the answer without touching the round clock", () => {
    const { state } = submitAnswer(fresh(), settings, right, 9_000)
    expect(state.roundStartedAt).toBe(1_000)
    expect(state.lastAnswerAt).toBe(9_000)
  })

  it("only restarts the clock when the next round is served", () => {
    const { state } = submitAnswer(fresh(), settings, right, 9_000)
    expect(beginRound(state, 20_000).roundStartedAt).toBe(20_000)
  })
})

describe("timers", () => {
  it("exposes the three deadlines", () => {
    const state = fresh()
    expect(totalTimeDeadline(state, settings)).toBe(1_000 + 120_000)
    expect(questionDeadline(state, settings)).toBe(1_000 + 30_000)
    expect(selectionDeadline(state, settings)).toBe(1_000 + 15_000)
  })

  it("reports null deadlines when a limit is disabled", () => {
    const open = baseSettingsSchema.parse({
      totalTimeLimitSeconds: null,
      questionTimeLimitSeconds: null,
      selectionTimeLimitSeconds: null,
    })
    const state = fresh()
    expect(totalTimeDeadline(state, open)).toBeNull()
    expect(questionDeadline(state, open)).toBeNull()
    expect(selectionDeadline(state, open)).toBeNull()
  })

  it("detects the total timeout boundary", () => {
    expect(hasTimedOut(fresh(), settings, 121_000)).toBe(false)
    expect(hasTimedOut(fresh(), settings, 121_001)).toBe(true)
  })
})

describe("expireQuestion", () => {
  it("removes a life without scoring", () => {
    const { state } = expireQuestion(fresh(), settings, 5_000)
    expect(state.lives).toBe(1)
    expect(state.score).toBe(0)
    expect(state.roundsPlayed).toBe(1)
  })

  it("loses the game when it was the last life", () => {
    const oneLeft = expireQuestion(fresh(), settings, 5_000).state
    const { state } = expireQuestion(oneLeft, settings, 6_000)
    expect(state.status).toBe("lost")
  })
})

describe("ranking eligibility", () => {
  it("counts solo and online games", () => {
    expect(countsForRanking({ mode: "solo" })).toBe(true)
    expect(countsForRanking({ mode: "online" })).toBe(true)
  })

  it("excludes coop and offline practice", () => {
    expect(countsForRanking({ mode: "coop" })).toBe(false)
    expect(countsForRanking({ mode: "practice" })).toBe(false)
  })
})

describe("finishSession", () => {
  it("keeps the earned score", () => {
    const scored = submitAnswer(fresh(), settings, right, 2_000).state
    const done = finishSession(scored, "won")
    expect(done.status).toBe("won")
    expect(done.score).toBe(1)
  })

  it("does not resurrect a finished session", () => {
    const lost = { ...fresh(), status: "lost" as const }
    expect(finishSession(lost).status).toBe("lost")
  })
})
