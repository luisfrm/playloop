import type { ContentRepository } from "@playloop/db"
import {
  baseSettingsSchema,
  checkName,
  gameTypes,
  type BaseSettings,
  type ContentItem,
  type GameTypeDefinition,
  type RoomErrorReason,
  type RoomPublicState,
  type RoomRound,
} from "@playloop/game-engine"

import type { CloudflareEnv } from "./cloudflare-context"
import { repositoryFromEnv } from "./repository.server"
import { readSettings } from "./settings.server"

/**
 * The cooperative room API.
 *
 * It runs in the Worker entry rather than in a React Router route because a room
 * needs a WebSocket, which a loader cannot upgrade. Commands are Durable Object
 * RPC calls; only the socket goes through `fetch`.
 */

/** Mirrors the Durable Object's result so this module needs no Worker globals. */
export type RoomActionResult = {
  ok: boolean
  reason?: string
  room: RoomPublicState | null
}

type RoomStub = {
  create(input: {
    code: string
    gameInstanceId: string
    gameTypeKey: string
    gameSlug: string
    hostId: string
    hostName: string
    rounds: RoomRound[]
    optionLabels: Record<string, string>
    questionDurationMs: number
  }): Promise<void>
  join(playerId: string, name: string): Promise<RoomActionResult>
  start(playerId: string): Promise<RoomActionResult>
  answer(playerId: string, optionId: string): Promise<RoomActionResult>
  leave(playerId: string): Promise<RoomActionResult>
  snapshot(): Promise<RoomPublicState | null>
  fetch(request: Request): Promise<Response>
}

type RoomNamespace = { getByName(name: string): RoomStub }

type Payload = Record<string, unknown>

type AnyDefinition = GameTypeDefinition<
  Payload,
  BaseSettings & { answerMode?: "classic" | "expert" }
>

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 6
/** A room is a session, not an endless quiz: ten rounds is plenty. */
const ROUNDS_PER_ROOM = 10
const ROOM_PATH = /^\/api\/room(?:\/([A-Za-z0-9]+))?$/
const DEFAULT_QUESTION_SECONDS = 30

const REASON_MESSAGES: Record<RoomErrorReason, string> = {
  no_room: "Esa sala ya no existe.",
  room_full: "La sala está llena (máximo 8 jugadores).",
  already_joined: "Ya estás en esta sala.",
  not_a_member: "No estás en esta sala.",
  not_the_host: "Solo quien creó la sala puede empezarla.",
  wrong_phase: "La sala ya no acepta esa acción.",
  already_answered: "Ya has respondido a esta pregunta.",
  unknown_option: "Esa opción no es válida.",
  exhausted: "No quedan más preguntas.",
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

async function readJson(request: Request): Promise<Payload | null> {
  try {
    return (await request.json()) as Payload
  } catch {
    return null
  }
}

function textOf(payload: Payload, field: string | undefined): string {
  if (!field) return ""
  const value = payload[field]
  return typeof value === "string" ? value : ""
}

export function roomNamespace(env: CloudflareEnv): RoomNamespace | null {
  const rooms = env.ROOMS as RoomNamespace | undefined
  return rooms && typeof rooms.getByName === "function" ? rooms : null
}

/** Unambiguous alphabet: no O/0, no I/1. Codes get read out loud. */
function mintRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return [...bytes]
    .map((byte) => CODE_ALPHABET.charAt(byte % CODE_ALPHABET.length))
    .join("")
}

function questionDurationMs(settings: BaseSettings): number {
  const seconds = settings.questionTimeLimitSeconds ?? DEFAULT_QUESTION_SECONDS
  return seconds * 1000
}

/**
 * Which option of a round is the correct one.
 *
 * Asked of the game type rather than assumed: `resolveAnswer` is the single
 * definition of "correct", so a new game type needs no change here.
 */
function answerOptionOf(
  definition: AnyDefinition,
  round: { prompt: ContentItem<Payload>; options: ContentItem<Payload>[] },
  settings: BaseSettings
): string {
  const correct = round.options.find(
    (option) =>
      definition.resolveAnswer({
        prompt: round.prompt,
        options: round.options,
        settings,
        dictionary: [],
        answer: { kind: "option", contentItemId: option.id },
      }).correct
  )
  return correct?.id ?? round.prompt.id
}

/**
 * Freezes the instance's content into the queue of rounds the room walks
 * through. Built once, up front, so the room never reads content and the answer
 * only ever exists inside the Durable Object.
 */
export function buildRoomRounds(input: {
  definition: AnyDefinition
  pool: ContentItem<Payload>[]
  settings: BaseSettings
  random?: () => number
  count?: number
}): { rounds: RoomRound[]; optionLabels: Record<string, string> } {
  const random = input.random ?? Math.random
  const count = input.count ?? ROUNDS_PER_ROOM
  const presentation = input.definition.presentation

  const rounds: RoomRound[] = []
  const optionLabels: Record<string, string> = {}
  const asked: string[] = []

  for (let index = 0; index < count; index++) {
    const fresh = input.pool.filter((item) => !asked.includes(item.id))
    const usable = fresh.length >= 2 ? fresh : input.pool
    const round = input.definition.buildRound({
      pool: usable,
      settings: input.settings,
      random,
    })
    if (!round) break

    for (const option of round.options) {
      optionLabels[option.id] = textOf(
        option.payload,
        presentation.optionLabelField
      )
    }

    rounds.push({
      prompt: {
        mediaUrl: textOf(round.prompt.payload, presentation.promptMediaField),
        caption:
          textOf(round.prompt.payload, presentation.promptCaptionField) ||
          undefined,
      },
      optionIds: round.options.map((option) => option.id),
      answerOptionId: answerOptionOf(input.definition, round, input.settings),
    })
    asked.push(round.prompt.id)
  }

  return { rounds, optionLabels }
}

async function rememberPlayer(
  repository: ContentRepository,
  playerId: string,
  displayName: string
): Promise<void> {
  const now = Date.now()
  await repository.upsertPlayer({
    id: playerId,
    displayName,
    createdAt: now,
    updatedAt: now,
  })
}

/** A validated display name, or the message explaining why it was rejected. */
async function validateName(
  repository: ContentRepository,
  rawName: string
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const { nameMaxLength } = await readSettings(repository)
  const name = rawName.trim().slice(0, nameMaxLength)
  if (name.length < 2) {
    return {
      ok: false,
      message: "Necesitas un nombre de al menos 2 caracteres.",
    }
  }
  const decision = checkName(name, await repository.listBlockedTerms())
  return decision.allowed
    ? { ok: true, name }
    : { ok: false, message: "Ese nombre no está permitido. Prueba otro." }
}

async function loadSettings(instance: {
  gameTypeKey: string
  settings: unknown
}): Promise<{ definition: AnyDefinition; settings: BaseSettings }> {
  const definition = gameTypes.require(instance.gameTypeKey) as AnyDefinition
  const parsed = definition.settingsSchema.safeParse(instance.settings)
  const settings = {
    ...baseSettingsSchema.parse({}),
    ...(parsed.success ? parsed.data : {}),
  } as BaseSettings
  return { definition, settings }
}

async function createRoomRequest(
  request: Request,
  env: CloudflareEnv,
  rooms: RoomNamespace
): Promise<Response> {
  const body = await readJson(request)
  if (!body) return json({ error: "Cuerpo inválido." }, 400)

  const playerId = String(body["playerId"] ?? "")
  if (!playerId) return json({ error: "Falta el jugador." }, 400)

  const repository = await repositoryFromEnv(env)
  const name = await validateName(repository, String(body["playerName"] ?? ""))
  if (!name.ok) return json({ error: name.message }, 400)

  const instance = await repository.getInstanceBySlug(
    String(body["slug"] ?? "")
  )
  if (!instance || !instance.published) {
    return json({ error: "Ese juego no existe o no está publicado." }, 404)
  }

  const { definition, settings } = await loadSettings(instance)
  const pool = (await repository.listContent(
    instance.id
  )) as ContentItem<Payload>[]
  if (pool.length < 2) {
    return json(
      { error: "Este juego todavía no tiene contenido suficiente." },
      409
    )
  }

  const { rounds, optionLabels } = buildRoomRounds({
    definition,
    pool,
    settings,
  })
  if (rounds.length === 0) {
    return json({ error: "No se pudo preparar ninguna ronda." }, 409)
  }

  const code = mintRoomCode()
  const stub = rooms.getByName(code)
  await stub.create({
    code,
    gameInstanceId: instance.id,
    gameTypeKey: instance.gameTypeKey,
    gameSlug: instance.slug,
    hostId: playerId,
    hostName: name.name,
    rounds,
    optionLabels,
    questionDurationMs: questionDurationMs(settings),
  })
  await rememberPlayer(repository, playerId, name.name)

  return json({ ok: true, code, room: await stub.snapshot() })
}

async function joinRoomRequest(
  request: Request,
  env: CloudflareEnv,
  stub: RoomStub,
  body: Payload,
  playerId: string
): Promise<Response> {
  const repository = await repositoryFromEnv(env)
  const name = await validateName(repository, String(body["playerName"] ?? ""))
  if (!name.ok) return json({ error: name.message }, 400)

  const result = await stub.join(playerId, name.name)
  if (result.ok) await rememberPlayer(repository, playerId, name.name)
  return json(roomPayload(result), result.ok ? 200 : 409)
}

/** Attach the human-readable reason in one place, so every client shows it. */
function roomPayload(result: RoomActionResult): RoomActionResult & {
  message?: string
} {
  const reason = result.reason as RoomErrorReason | undefined
  return {
    ...result,
    message: reason ? REASON_MESSAGES[reason] : undefined,
  }
}

async function roomActionRequest(
  request: Request,
  env: CloudflareEnv,
  stub: RoomStub,
  body: Payload,
  playerId: string
): Promise<Response> {
  const action = String(body["action"] ?? "")

  if (action === "join") {
    return joinRoomRequest(request, env, stub, body, playerId)
  }

  if (action === "start") {
    const result = await stub.start(playerId)
    return json(roomPayload(result), result.ok ? 200 : 409)
  }

  if (action === "leave") {
    const result = await stub.leave(playerId)
    return json(roomPayload(result), result.ok ? 200 : 409)
  }

  if (action === "answer") {
    const optionId = String(body["optionId"] ?? "")
    if (!optionId) return json({ error: "Falta la opción." }, 400)
    const result = await stub.answer(playerId, optionId)
    return json(roomPayload(result), result.ok ? 200 : 409)
  }

  return json({ error: "Acción desconocida." }, 400)
}

/**
 * The Worker calls this before React Router. `null` means "not a room request",
 * so the call falls through to SSR.
 */
export async function handleRoomRequest(
  request: Request,
  env: CloudflareEnv
): Promise<Response | null> {
  const match = ROOM_PATH.exec(new URL(request.url).pathname)
  if (!match) return null

  const rooms = roomNamespace(env)
  if (!rooms) {
    return json({ error: "El modo cooperativo no está disponible aquí." }, 501)
  }

  const code = (match[1] ?? "").toUpperCase()
  if (!code) {
    return request.method === "POST"
      ? createRoomRequest(request, env, rooms)
      : json({ error: "Falta el código de sala." }, 400)
  }

  if (request.method !== "POST") {
    // Snapshot and WebSocket upgrade both live in the Durable Object.
    return rooms.getByName(code).fetch(request)
  }

  const body = await readJson(request)
  if (!body) return json({ error: "Cuerpo inválido." }, 400)

  const playerId = String(body["playerId"] ?? "")
  if (!playerId) return json({ error: "Falta el jugador." }, 400)

  return roomActionRequest(request, env, rooms.getByName(code), body, playerId)
}
