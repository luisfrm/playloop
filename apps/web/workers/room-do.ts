import { DurableObject } from "cloudflare:workers"

import {
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
  shouldDestroy,
  startRoom,
  submitRoomAnswer,
  type RoomCommand,
  type RoomPublicState,
  type RoomRound,
  type RoomState,
} from "@playloop/game-engine"

import type { Env } from "./env"

export type { Env }

const ROOM_KEY = "room"

/** What a room action reports back, so the Worker can answer the HTTP request. */
export type RoomActionResult = {
  ok: boolean
  reason?: string
  room: RoomPublicState | null
}

/**
 * The room is the single authority on time and state: no timer lives only in a
 * client. Every mutation persists before it broadcasts, and every mutation
 * reschedules the alarm so an abandoned room releases its code.
 */
export class RoomDurableObject extends DurableObject<Env> {
  private room: RoomState | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>(ROOM_KEY)) ?? null
    })
  }

  private async persist(room: RoomState): Promise<void> {
    this.room = room
    await this.ctx.storage.put(ROOM_KEY, room)
    await this.ctx.storage.setAlarm(alarmAt(room, Date.now()))
    this.broadcast()
  }

  /** Persist only when the rules accepted the command. */
  private async apply(command: RoomCommand): Promise<RoomActionResult> {
    if (command.ok) await this.persist(command.state)
    return {
      ok: command.ok,
      reason: command.ok ? undefined : command.reason,
      room: this.snapshotOf(),
    }
  }

  private snapshotOf(): RoomPublicState | null {
    return this.room ? publicRoomState(this.room) : null
  }

  private broadcast(): void {
    if (!this.room) return
    const payload = JSON.stringify({
      type: "room.state",
      state: publicRoomState(this.room),
    })

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
      } catch {
        socket.close(1011, "send failed")
      }
    }
  }

  /**
   * Create or reuse the room for this code. The rounds arrive ready-made: the
   * room never reads content, so it stays game-type agnostic.
   */
  async create(input: {
    code: string
    gameInstanceId: string
    gameTypeKey: string
    gameSlug: string
    hostId: string
    hostName: string
    rounds: RoomRound[]
    optionLabels: Record<string, string>
    questionDurationMs: number
  }): Promise<void> {
    if (this.room) return
    await this.persist(createRoom({ ...input, now: Date.now() }))
  }

  async join(playerId: string, name: string): Promise<RoomActionResult> {
    if (!this.room) return { ok: false, reason: "no_room", room: null }
    return this.apply(joinRoom(this.room, { playerId, name }, Date.now()))
  }

  async leave(playerId: string): Promise<RoomActionResult> {
    if (!this.room) return { ok: false, reason: "no_room", room: null }
    await this.persist(leaveRoom(this.room, playerId, Date.now()))
    return { ok: true, room: this.snapshotOf() }
  }

  async start(playerId: string): Promise<RoomActionResult> {
    if (!this.room) return { ok: false, reason: "no_room", room: null }
    return this.apply(startRoom(this.room, playerId, Date.now()))
  }

  async answer(playerId: string, optionId: string): Promise<RoomActionResult> {
    if (!this.room) return { ok: false, reason: "no_room", room: null }

    const command = submitRoomAnswer(this.room, playerId, optionId, Date.now())
    if (!command.ok) {
      return { ok: false, reason: command.reason, room: this.snapshotOf() }
    }

    // Everyone answered: the room serves the next round itself, and ends when
    // the queue runs out. The alarm does the same when the clock runs out —
    // progression never belongs to a client.
    let next = command.state
    if (everyoneAnswered(next)) {
      const now = Date.now()
      const advanced = advanceRoom(next, now)
      next = advanced.ok ? advanced.state : finishRoom(next, now)
    }

    await this.persist(next)
    return { ok: true, room: this.snapshotOf() }
  }

  snapshot(): RoomPublicState | null {
    return this.snapshotOf()
  }

  /** The alarm is the room's clock. It never depends on a client being awake. */
  async alarm(): Promise<void> {
    const room = this.room
    if (!room) return

    const now = Date.now()
    if (shouldDestroy(room, now)) {
      this.room = null
      await this.ctx.storage.deleteAll()
      for (const socket of this.ctx.getWebSockets()) {
        socket.close(1000, "room expired")
      }
      return
    }

    if (room.phase === "playing" && isQuestionExpired(room, now)) {
      // The question ran out: move on without waiting for the stragglers. When
      // the queue is empty the room is over.
      const advanced = advanceRoom(room, now)
      await this.persist(advanced.ok ? advanced.state : finishRoom(room, now))
      return
    }

    await this.ctx.storage.setAlarm(alarmAt(room, now))
  }

  /** The socket carries state; every mutation is an RPC call. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return Response.json({ state: this.snapshotOf() })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    // Hibernation: the room costs nothing while everybody is idle.
    this.ctx.acceptWebSocket(server)

    const playerId = new URL(request.url).searchParams.get("playerId")
    if (playerId) {
      server.serializeAttachment({ playerId })
      if (this.room) {
        const command = joinRoom(
          this.room,
          { playerId, name: playerId },
          Date.now()
        )
        if (command.ok) await this.persist(command.state)
      }
    }

    server.send(
      JSON.stringify({
        type: "room.state",
        state: this.snapshotOf(),
      })
    )
    return new Response(null, { status: 101, webSocket: client })
  }

  /** Liveness only: it keeps the room alive without touching the score. */
  async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    if (typeof message !== "string" || message !== "ping") return
    if (!this.room) return

    const room = { ...this.room, lastActivityAt: Date.now() }
    this.room = room
    await this.ctx.storage.put(ROOM_KEY, room)
    socket.send(JSON.stringify({ type: "pong" }))
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const playerId = socket.deserializeAttachment()?.playerId as
      | string
      | undefined
    if (!playerId || !this.room) return
    await this.persist(markDisconnected(this.room, playerId, Date.now()))
  }
}

export default RoomDurableObject
