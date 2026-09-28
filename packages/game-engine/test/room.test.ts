import { describe, expect, it } from "vitest"

import {
  alarmAt,
  createRoom,
  expireTurn,
  finishRoom,
  isTurnExpired,
  joinRoom,
  leaveRoom,
  markDisconnected,
  publicRoomState,
  ranking,
  restartRoom,
  ROOM_COMPLETION_BONUS,
  shouldDestroy,
  startRoom,
  submitRoomAnswer,
  type RoomBoard,
  type RoomState,
} from "../src/realtime/room.js"

const TURNS = 10_000

function board(): RoomBoard {
  return {
    optionIds: ["t1", "t2", "f1", "f2"],
    correctIds: ["t1", "t2"],
    foundIds: [],
    falseIds: [],
  }
}

const labels = { t1: "Uno", t2: "Dos", f1: "Tres", f2: "Cuatro" }

function freshInput() {
  return { board: board(), optionLabels: labels, optionMedia: {} }
}

function setup(names = ["a", "b", "c"], lives = 3): RoomState {
  const [host, ...rest] = names
  let state = createRoom({
    code: "ABC123",
    gameInstanceId: "inst",
    gameTypeKey: "true_false",
    gameSlug: "slug",
    hostId: host ?? "a",
    hostName: "Ana",
    board: board(),
    optionLabels: labels,
    optionMedia: {},
    turnDurationMs: TURNS,
    initialLives: lives,
    now: 1_000,
  })
  rest.forEach((playerId, index) => {
    const joined = joinRoom(
      state,
      { playerId, name: `Jugador ${index}` },
      1_000 + index
    )
    if (!joined.ok) throw new Error("join failed")
    state = joined.state
  })
  const started = startRoom(state, host ?? "a", 2_000)
  if (!started.ok) throw new Error(`start failed: ${started.reason}`)
  return started.state
}

function pick(
  state: RoomState,
  playerId: string,
  optionId: string,
  now = 3_000
): RoomState {
  const command = submitRoomAnswer(state, playerId, optionId, now)
  if (!command.ok) throw new Error(`pick failed: ${command.reason}`)
  return command.state
}

function scoreOf(state: RoomState, playerId: string): number {
  return (
    state.members.find((member) => member.playerId === playerId)?.score ?? -1
  )
}

function livesOf(state: RoomState, playerId: string): number {
  return (
    state.members.find((member) => member.playerId === playerId)?.lives ?? -1
  )
}

describe("lobby", () => {
  it("starts with the host holding the first turn of round one", () => {
    const state = setup(["a", "b"])
    expect(state.phase).toBe("playing")
    expect(state.roundNumber).toBe(1)
    expect(state.turn?.turnMemberId).toBe("a")
    expect(state.turn?.expiresAt).toBe(2_000 + TURNS)
  })

  it("only lets the host start", () => {
    let state = createRoom({
      code: "ABC123",
      gameInstanceId: "inst",
      gameTypeKey: "true_false",
      gameSlug: "slug",
      hostId: "a",
      hostName: "Ana",
      board: board(),
      optionLabels: labels,
      optionMedia: {},
      turnDurationMs: TURNS,
      initialLives: 3,
      now: 1_000,
    })
    const joined = joinRoom(state, { playerId: "b", name: "Beto" }, 1_100)
    if (!joined.ok) throw new Error("join failed")
    state = joined.state

    expect(startRoom(state, "b", 2_000).ok).toBe(false)
    expect(startRoom(state, "a", 2_000).ok).toBe(true)
  })

  it("refuses late joins and full rooms", () => {
    const playing = setup(["a", "b"])
    expect(joinRoom(playing, { playerId: "z", name: "Zed" }, 9_000).ok).toBe(
      false
    )

    let lobby = createRoom({
      code: "FULL",
      gameInstanceId: "inst",
      gameTypeKey: "true_false",
      gameSlug: "slug",
      hostId: "host",
      hostName: "Anfitrion",
      board: board(),
      optionLabels: labels,
      optionMedia: {},
      turnDurationMs: TURNS,
      initialLives: 3,
      now: 1_000,
    })
    for (let index = 0; index < 7; index++) {
      const joined = joinRoom(
        lobby,
        { playerId: `m${index}`, name: `Miembro ${index}` },
        1_100 + index
      )
      expect(joined.ok).toBe(true)
      if (joined.ok) lobby = joined.state
    }
    expect(lobby.members).toHaveLength(8)
    const overflow = joinRoom(
      lobby,
      { playerId: "extra", name: "Extra" },
      2_000
    )
    expect(overflow.ok).toBe(false)
    if (!overflow.ok) expect(overflow.reason).toBe("room_full")
  })
})

describe("strict turns", () => {
  it("rotates through the seats and opens a new round on wrap", () => {
    let state = setup(["a", "b", "c"])
    state = pick(state, "a", "t1")
    expect(state.turn?.turnMemberId).toBe("b")
    expect(state.roundNumber).toBe(1)

    state = pick(state, "b", "f1")
    expect(state.turn?.turnMemberId).toBe("c")
    expect(livesOf(state, "b")).toBe(2)

    state = pick(state, "c", "f2")
    // Table wrapped: round two starts and everyone standing banks a point.
    expect(state.roundNumber).toBe(2)
    expect(state.turn?.turnMemberId).toBe("a")
    expect(scoreOf(state, "a")).toBe(1)
    expect(scoreOf(state, "b")).toBe(1)
    expect(scoreOf(state, "c")).toBe(1)
  })

  it("rejects out-of-turn picks and re-picks of locked cells", () => {
    const state = setup(["a", "b"])
    const wrongTurn = submitRoomAnswer(state, "b", "t1", 3_000)
    expect(wrongTurn.ok).toBe(false)
    if (!wrongTurn.ok) expect(wrongTurn.reason).toBe("not_your_turn")

    const played = pick(state, "a", "t1")
    const relocked = submitRoomAnswer(played, "b", "t1", 3_100)
    expect(relocked.ok).toBe(false)
    if (!relocked.ok) expect(relocked.reason).toBe("already_resolved")

    const invented = submitRoomAnswer(played, "b", "no-existe", 3_100)
    expect(invented.ok).toBe(false)
    if (!invented.ok) expect(invented.reason).toBe("unknown_option")
  })

  it("skips the eliminated when the turn moves on", () => {
    let state = setup(["a", "b", "c"], 1)
    state = pick(state, "a", "f1")
    expect(livesOf(state, "a")).toBe(0)
    // b takes their turn; the table is still in round one.
    expect(state.turn?.turnMemberId).toBe("b")
    state = pick(state, "b", "t1")
    expect(state.turn?.turnMemberId).toBe("c")
  })

  it("scores R-1 points for an elimination in round R", () => {
    // a and b fall in round one (0 points); c survives into round two,
    // banks the survival point and wins the table: (2-1)+2 = 3.
    let state = setup(["a", "b", "c"], 1)
    state = pick(state, "a", "f1")
    state = pick(state, "b", "f2")
    state = pick(state, "c", "t1")

    expect(state.phase).toBe("finished")
    expect(scoreOf(state, "a")).toBe(0)
    expect(scoreOf(state, "b")).toBe(0)
    expect(scoreOf(state, "c")).toBe(3)
  })

  it("lets everyone standing share the win when the board completes", () => {
    let state = setup(["a", "b"], 3)
    state = pick(state, "a", "t1")
    state = pick(state, "b", "t2")

    expect(state.phase).toBe("finished")
    expect(scoreOf(state, "a")).toBe(ROOM_COMPLETION_BONUS)
    expect(scoreOf(state, "b")).toBe(ROOM_COMPLETION_BONUS)
  })

  it("ends with no bonus when nobody is left standing", () => {
    let state = setup(["a", "b"], 1)
    state = pick(state, "a", "f1")
    state = pick(state, "b", "f2")

    expect(state.phase).toBe("finished")
    expect(scoreOf(state, "a")).toBe(0)
    expect(scoreOf(state, "b")).toBe(0)
  })
})

describe("expireTurn", () => {
  it("costs the holder a life and moves the table on", () => {
    let state = setup(["a", "b"])
    const expired = expireTurn(state, 2_000 + TURNS)
    expect(expired.ok).toBe(true)
    if (!expired.ok) return

    state = expired.state
    expect(livesOf(state, "a")).toBe(2)
    expect(state.turn?.turnMemberId).toBe("b")
    expect(state.board.foundIds).toEqual([])
    expect(state.board.falseIds).toEqual([])
  })

  it("is driven by the turn clock", () => {
    const state = setup(["a", "b"])
    expect(isTurnExpired(state, 2_000)).toBe(false)
    expect(isTurnExpired(state, 2_000 + TURNS)).toBe(true)
  })
})

describe("leaving", () => {
  it("hands the turn to the next seat when the holder leaves", () => {
    let state = setup(["a", "b", "c"])
    state = leaveRoom(state, "a", 5_000)
    expect(state.turn?.turnMemberId).toBe("b")
    expect(state.phase).toBe("playing")
  })

  it("ends the match at once when a single member is left standing", () => {
    let state = setup(["a", "b", "c"])
    state = leaveRoom(state, "a", 5_000)
    state = leaveRoom(state, "b", 5_100)
    expect(state.phase).toBe("finished")
    expect(scoreOf(state, "c")).toBe(ROOM_COMPLETION_BONUS)
  })

  it("marks disconnections without stalling the table", () => {
    let state = setup(["a", "b"])
    state = markDisconnected(state, "b", 5_000)
    state = pick(state, "a", "t1")
    expect(state.turn?.turnMemberId).toBe("b")
  })
})

describe("rematch", () => {
  it("restarts inside the room keeping members and totals", () => {
    let state = setup(["a", "b", "c"], 1)
    state = pick(state, "a", "f1")
    state = pick(state, "b", "f2")
    state = pick(state, "c", "t1")
    expect(state.phase).toBe("finished")

    const restarted = restartRoom(state, "a", freshInput(), 9_000)
    expect(restarted.ok).toBe(true)
    if (!restarted.ok) return
    state = restarted.state

    expect(state.phase).toBe("playing")
    expect(state.matchNumber).toBe(2)
    expect(state.roundNumber).toBe(1)
    expect(state.members.map((member) => member.score)).toEqual([0, 0, 0])
    expect(state.members.map((member) => member.lives)).toEqual([1, 1, 1])
    // The first match banked: c won 3, a and b nothing.
    expect(state.members.map((member) => member.totalScore)).toEqual([0, 0, 3])
    // The starter rotates to the second seat.
    expect(state.turn?.turnMemberId).toBe("b")
    expect(state.board.foundIds).toEqual([])
  })

  it("only restarts a finished room, and only the host", () => {
    const playing = setup(["a", "b"])
    expect(restartRoom(playing, "a", freshInput(), 9_000).ok).toBe(false)

    let state = setup(["a", "b"], 1)
    state = pick(state, "a", "f1")
    state = pick(state, "b", "f2")
    expect(state.phase).toBe("finished")

    const intruder = restartRoom(state, "b", freshInput(), 9_000)
    expect(intruder.ok).toBe(false)
    if (!intruder.ok) expect(intruder.reason).toBe("not_the_host")
  })
})

describe("public state", () => {
  it("never leaks the answers", () => {
    let state = setup(["a", "b"])
    state = pick(state, "a", "t1")
    const snapshot = publicRoomState(state)

    expect(JSON.stringify(snapshot)).not.toContain("correctIds")
    expect(
      snapshot.board.options.find((option) => option.id === "t1")?.resolved
    ).toBe("true")
    expect(snapshot.board.found).toBe(1)
    expect(snapshot.board.total).toBe(2)
    expect(snapshot.turn?.turnMemberId).toBe("b")
  })

  it("ranks the match by score", () => {
    let state = setup(["a", "b", "c"])
    state = pick(state, "a", "t1")
    state = pick(state, "b", "f1")
    state = pick(state, "c", "f2")
    // Round two: everyone standing banked one point; b and c missed nothing else.
    expect(ranking(state).map((member) => member.playerId)).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("schedules alarms off the turn clock", () => {
    const state = setup(["a", "b"])
    expect(alarmAt(state, 2_000)).toBe(2_000 + TURNS)
    expect(shouldDestroy(state, 2_000)).toBe(false)

    const done = finishRoom(state, 5_000)
    expect(shouldDestroy(done, 5_000)).toBe(false)
  })
})
