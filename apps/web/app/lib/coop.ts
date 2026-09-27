import type { RoomPublicState } from "@playloop/game-engine"

/**
 * Browser client for cooperative rooms.
 *
 * Commands are plain POSTs and the state arrives over one socket. The client
 * never decides a score: it sends an option id and renders whatever the room
 * publishes.
 */

export type RoomActionResult = {
  ok: boolean
  reason?: string
  message?: string
  room: RoomPublicState | null
}

export type RoomResponse = RoomActionResult & {
  error?: string
  code?: string
}

async function post(path: string, body: unknown): Promise<RoomResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  try {
    return (await response.json()) as RoomResponse
  } catch {
    return { ok: false, room: null, error: "Respuesta inesperada." }
  }
}

/** The failure message a screen can show: server `error`, then room `message`. */
export function roomFailure(payload: RoomResponse): string {
  return payload.error ?? payload.message ?? "No se pudo completar la acción."
}

export async function createRoom(input: {
  slug: string
  playerId: string
  playerName: string
}): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  const payload = await post("/api/room", input)
  if (!payload.ok || !payload.code) {
    return { ok: false, message: roomFailure(payload) }
  }
  return { ok: true, code: payload.code }
}

export function joinRoom(
  code: string,
  playerId: string,
  playerName: string
): Promise<RoomResponse> {
  return post(`/api/room/${code}`, { action: "join", playerId, playerName })
}

export function startRoom(
  code: string,
  playerId: string
): Promise<RoomResponse> {
  return post(`/api/room/${code}`, { action: "start", playerId })
}

export function answerRoom(
  code: string,
  playerId: string,
  optionId: string
): Promise<RoomResponse> {
  return post(`/api/room/${code}`, { action: "answer", playerId, optionId })
}

export function leaveRoom(
  code: string,
  playerId: string
): Promise<RoomResponse> {
  return post(`/api/room/${code}`, { action: "leave", playerId })
}

/**
 * Streams the room state. Returns a disposer.
 *
 * A periodic ping keeps an idle lobby from being reaped by the room's
 * inactivity TTL.
 */
export function connectRoom(input: {
  code: string
  playerId: string
  onState: (state: RoomPublicState | null) => void
  onClosed: () => void
}): () => void {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws"
  const socket = new WebSocket(
    `${scheme}://${window.location.host}/api/room/${input.code}?playerId=${encodeURIComponent(input.playerId)}`
  )

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as {
        type?: string
        state?: RoomPublicState | null
      }
      if (payload.type === "room.state") input.onState(payload.state ?? null)
    } catch {
      // A malformed frame is not worth tearing the room down for.
    }
  })
  socket.addEventListener("close", input.onClosed)

  const pinger = window.setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send("ping")
  }, 20_000)

  return () => {
    window.clearInterval(pinger)
    socket.close()
  }
}
