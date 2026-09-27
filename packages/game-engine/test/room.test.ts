import { describe, expect, it } from "vitest"

import {
  MAX_ROOM_MEMBERS,
  ROOM_FINISHED_TTL_MS,
  ROOM_INACTIVITY_TTL_MS,
  advanceRoom,
  alarmAt,
  createRoom,
  everyoneAnswered,
  finishRoom,
  isQuestionExpired,
  joinRoom,
  leaveRoom,
  markDisconnected,
  publicRoomState,
  ranking,
  shouldDestroy,
  startRoom,
  submitRoomAnswer,
  type RoomRound,
  type RoomState,
} from "../src/realtime/room.js"

const ROUNDS: RoomRound[] = [
  {
    prompt: { mediaUrl: "/uno.png", caption: "Primero" },
    optionIds: ["o1", "o2"],
    answerOptionId: "o1",
  },
  {
    prompt: { mediaUrl: "/dos.png" },
    optionIds: ["o1", "o2"],
    answerOptionId: "o2",
  },
]

function room(): RoomState {
  return createRoom({
    code: "ABC123",
    gameInstanceId: "inst",
    gameTypeKey: "true_false",
    gameSlug: "tema-de-prueba",
    hostId: "host",
    hostName: "Ana",
    rounds: ROUNDS,
    optionLabels: { o1: "Elemento 1", o2: "Elemento 2" },
    questionDurationMs: 30_000,
    now: 1_000,
  })
}

function playing(): RoomState {
  const command = startRoom(room(), "host", 2_000)
  if (!command.ok) throw new Error("expected the room to start")
  return command.state
}

function joined(): RoomState {
  const command = joinRoom(room(), { playerId: "p2", name: "Beto" }, 1_500)
  if (!command.ok) throw new Error("expected the join")
  return command.state
}

describe("createRoom", () => {
  it("starts in the lobby with the host joined", () => {
    const state = room()
    expect(state.phase).toBe("lobby")
    expect(state.members).toHaveLength(1)
    expect(state.question).toBeNull()
    expect(state.cursor).toBe(0)
  })
})

describe("joinRoom", () => {
  it("adds a member and touches the activity clock", () => {
    const command = joinRoom(room(), { playerId: "p2", name: "Beto" }, 1_500)
    expect(command.ok).toBe(true)
    expect(command.state.members.map((member) => member.name)).toEqual([
      "Ana",
      "Beto",
    ])
    expect(command.state.lastActivityAt).toBe(1_500)
  })

  it("refuses a duplicate player", () => {
    const command = joinRoom(room(), { playerId: "host", name: "Ana" }, 1_500)
    expect(command).toMatchObject({ ok: false, reason: "already_joined" })
  })

  it("refuses once the room is full", () => {
    let state = room()
    for (let i = 2; i <= MAX_ROOM_MEMBERS; i++) {
      const command = joinRoom(
        state,
        { playerId: `p${i}`, name: `P${i}` },
        1_500
      )
      state = command.state
    }

    expect(state.members).toHaveLength(MAX_ROOM_MEMBERS)
    expect(
      joinRoom(state, { playerId: "extra", name: "Extra" }, 1_500)
    ).toMatchObject({ ok: false, reason: "room_full" })
  })

  it("refuses to join a room already in play", () => {
    expect(
      joinRoom(playing(), { playerId: "late", name: "Late" }, 3_000)
    ).toMatchObject({ ok: false, reason: "wrong_phase" })
  })
})

describe("startRoom", () => {
  it("only the host can start", () => {
    expect(startRoom(room(), "p2", 2_000)).toMatchObject({
      ok: false,
      reason: "not_the_host",
    })
  })

  it("refuses to start twice", () => {
    expect(startRoom(playing(), "host", 3_000)).toMatchObject({
      ok: false,
      reason: "wrong_phase",
    })
  })

  it("serves the first round and sets the authoritative deadline", () => {
    const state = playing()
    expect(state.question?.prompt.mediaUrl).toBe("/uno.png")
    expect(state.cursor).toBe(1)
    expect(state.questionCount).toBe(1)

    const deadline = state.question?.expiresAt ?? 0
    expect(deadline).toBe(2_000 + 30_000)
    expect(isQuestionExpired(state, deadline - 1)).toBe(false)
    expect(isQuestionExpired(state, deadline)).toBe(true)
  })

  it("refuses to start an empty room", () => {
    const empty = createRoom({
      code: "ZZ",
      gameInstanceId: "inst",
      gameTypeKey: "true_false",
      gameSlug: "tema-de-prueba",
      hostId: "host",
      hostName: "Ana",
      rounds: [],
      optionLabels: {},
      questionDurationMs: 30_000,
      now: 1_000,
    })
    expect(startRoom(empty, "host", 2_000)).toMatchObject({
      ok: false,
      reason: "exhausted",
    })
  })
})

describe("submitRoomAnswer", () => {
  it("scores a correct option and records who answered", () => {
    const command = submitRoomAnswer(playing(), "host", "o1", 2_500)
    expect(command.ok).toBe(true)
    expect(command.state.members[0]?.score).toBe(1)
    expect(command.state.question?.answeredBy).toEqual(["host"])
  })

  it("scores nothing for a wrong option", () => {
    const command = submitRoomAnswer(playing(), "host", "o2", 2_500)
    expect(command.ok).toBe(true)
    expect(command.state.members[0]?.score).toBe(0)
    expect(command.state.question?.answeredBy).toEqual(["host"])
  })

  it("refuses a second answer for the same question", () => {
    const first = submitRoomAnswer(playing(), "host", "o1", 2_500)
    if (!first.ok) throw new Error("expected the first answer")
    expect(submitRoomAnswer(first.state, "host", "o1", 2_600)).toMatchObject({
      ok: false,
      reason: "already_answered",
    })
  })

  it("refuses an option the round does not offer", () => {
    expect(
      submitRoomAnswer(playing(), "host", "inventada", 2_500)
    ).toMatchObject({ ok: false, reason: "unknown_option" })
  })

  it("refuses a score for a non-member", () => {
    expect(submitRoomAnswer(playing(), "intruso", "o1", 2_500)).toMatchObject({
      ok: false,
      reason: "not_a_member",
    })
  })

  it("refuses a score outside play", () => {
    expect(submitRoomAnswer(room(), "host", "o1", 2_500)).toMatchObject({
      ok: false,
      reason: "wrong_phase",
    })
  })
})

describe("everyoneAnswered", () => {
  it("waits for the disconnected members", () => {
    const left = markDisconnected(joined(), "p2", 1_600)
    const started = startRoom(left, "host", 2_000)
    if (!started.ok) throw new Error("expected the start")

    const answered = submitRoomAnswer(started.state, "host", "o1", 2_500)
    if (!answered.ok) throw new Error("expected the answer")
    expect(everyoneAnswered(answered.state)).toBe(true)
  })

  it("is false while somebody is still thinking", () => {
    const started = startRoom(joined(), "host", 2_000)
    if (!started.ok) throw new Error("expected the start")
    expect(everyoneAnswered(started.state)).toBe(false)
  })
})

describe("advanceRoom", () => {
  it("serves the next round and resets the answered list", () => {
    const command = advanceRoom(playing(), 4_000)
    if (!command.ok) throw new Error("expected the advance")

    expect(command.state.question?.prompt.mediaUrl).toBe("/dos.png")
    expect(command.state.question?.answeredBy).toEqual([])
    expect(command.state.questionCount).toBe(2)
    expect(command.state.cursor).toBe(2)
  })

  it("reports exhaustion when the queue is empty", () => {
    const first = advanceRoom(playing(), 4_000)
    if (!first.ok) throw new Error("expected the advance")

    const second = advanceRoom(first.state, 6_000)
    expect(second).toMatchObject({ ok: false, reason: "exhausted" })
  })

  it("refuses to advance a room that is not playing", () => {
    expect(advanceRoom(room(), 4_000)).toMatchObject({
      ok: false,
      reason: "wrong_phase",
    })
  })
})

describe("finishRoom", () => {
  it("moves to finished and clears the question", () => {
    const state = finishRoom(playing(), 9_000)
    expect(state.phase).toBe("finished")
    expect(state.question).toBeNull()
    expect(state.finishedAt).toBe(9_000)
  })
})

describe("leaveRoom", () => {
  it("hands the host role to the next member", () => {
    const after = leaveRoom(joined(), "host", 2_000)
    expect(after.hostId).toBe("p2")
    expect(after.members).toHaveLength(1)
  })

  it("finishes the room once it is empty", () => {
    const after = leaveRoom(room(), "host", 2_000)
    expect(after.phase).toBe("finished")
    expect(after.finishedAt).toBe(2_000)
  })
})

describe("alarms and TTL", () => {
  it("schedules the inactivity deadline in the lobby", () => {
    expect(alarmAt(room(), 1_000)).toBe(1_000 + ROOM_INACTIVITY_TTL_MS)
  })

  it("schedules the earlier of question end and inactivity", () => {
    expect(alarmAt(playing(), 2_000)).toBe(32_000)
  })

  it("schedules the short window once finished", () => {
    const finished = finishRoom(playing(), 9_000)
    expect(alarmAt(finished, 9_000)).toBe(9_000 + ROOM_FINISHED_TTL_MS)
  })

  it("survives inactivity but not forever", () => {
    const state = room()
    expect(
      shouldDestroy(state, state.lastActivityAt + ROOM_INACTIVITY_TTL_MS - 1)
    ).toBe(false)
    expect(
      shouldDestroy(state, state.lastActivityAt + ROOM_INACTIVITY_TTL_MS)
    ).toBe(true)
  })

  it("destroys a finished room after the short window", () => {
    const finished = finishRoom(playing(), 9_000)
    expect(shouldDestroy(finished, 9_000 + ROOM_FINISHED_TTL_MS - 1)).toBe(
      false
    )
    expect(shouldDestroy(finished, 9_000 + ROOM_FINISHED_TTL_MS)).toBe(true)
  })
})

describe("public state", () => {
  it("never publishes which option is the answer", () => {
    const state = publicRoomState(playing())
    expect(state.question).not.toBeNull()
    expect(JSON.stringify(state)).not.toContain("answerOptionId")
  })

  it("publishes the prompt and the labelled options", () => {
    const state = publicRoomState(playing())
    expect(state.question?.prompt.mediaUrl).toBe("/uno.png")
    expect(state.question?.prompt.caption).toBe("Primero")
    expect(state.question?.options).toEqual([
      { id: "o1", label: "Elemento 1" },
      { id: "o2", label: "Elemento 2" },
    ])
    expect(state.gameSlug).toBe("tema-de-prueba")
  })

  it("shows the current standings", () => {
    const answered = submitRoomAnswer(playing(), "host", "o1", 2_500)
    if (!answered.ok) throw new Error("expected the answer")
    expect(ranking(answered.state).map((member) => member.score)).toEqual([1])
  })
})
