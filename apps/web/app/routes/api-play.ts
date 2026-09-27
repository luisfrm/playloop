import { data } from "react-router"

import {
  PlayError,
  answerRound,
  expireRound,
  recordScore,
  startSession,
} from "@/lib/play-service.server"
import { getRepository } from "@/lib/repository.server"
import { getSessionStore, type SessionStore } from "@/lib/sessions.server"
import { checkName } from "@playloop/game-engine"
import type { ContentRepository } from "@playloop/db"

import type { Route } from "./+types/api-play"

type PlayRequest = {
  action?: "start" | "answer" | "expire"
  slug?: string
  sessionId?: string
  answerId?: string
  playerId?: string
  playerName?: string
  mode?: "classic" | "expert"
}

/** Everything a single intent needs, already resolved from the request. */
type PlayIntent = {
  body: PlayRequest
  repository: ContentRepository
  store: SessionStore
  playerId: string
}

const MAX_NAME_LENGTH = 24

/** Soft ceiling so a script cannot mint sessions in a loop. */
const MAX_STARTS_PER_MINUTE = 20
const START_WINDOW_MS = 60_000

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 })
  }

  let body: PlayRequest
  try {
    body = (await request.json()) as PlayRequest
  } catch {
    return data({ error: "Cuerpo inválido." }, { status: 400 })
  }

  const playerId = body.playerId ?? ""
  if (!playerId) return data({ error: "Falta el jugador." }, { status: 400 })

  const intent: PlayIntent = {
    body,
    repository: await getRepository(context),
    store: getSessionStore(context),
    playerId,
  }

  return body.action === "start" ? startGame(intent) : continueGame(intent)
}

/** Validates the player and opens a brand new session. */
async function startGame(intent: PlayIntent) {
  const { body, repository, store, playerId } = intent

  const blockedTerms = await repository.listBlockedTerms()
  const rawName = (body.playerName ?? "").trim().slice(0, MAX_NAME_LENGTH)
  if (rawName.length < 2) {
    return data(
      { error: "Necesitas un nombre de al menos 2 caracteres." },
      { status: 400 }
    )
  }
  if (!checkName(rawName, blockedTerms).allowed) {
    return data(
      { error: "Ese nombre no está permitido. Prueba otro." },
      { status: 400 }
    )
  }

  const attempts = await store.countRecent(`start:${playerId}`, START_WINDOW_MS)
  if (attempts > MAX_STARTS_PER_MINUTE) {
    return data(
      { error: "Demasiadas partidas seguidas. Espera un momento." },
      { status: 429 }
    )
  }

  const instance = await repository.getInstanceBySlug(body.slug ?? "")
  if (!instance || !instance.published) {
    return data(
      { error: "Ese juego no existe o no está publicado." },
      { status: 404 }
    )
  }

  const now = Date.now()
  await repository.upsertPlayer({
    id: playerId,
    displayName: rawName,
    createdAt: now,
    updatedAt: now,
  })

  try {
    const view = await startSession({
      repository,
      store,
      instance,
      playerId,
      requestedMode: body.mode === "expert" ? "expert" : "classic",
      random: Math.random,
    })
    return data({ ok: true, view })
  } catch (error) {
    if (error instanceof PlayError)
      return data({ error: error.message }, { status: 409 })
    throw error
  }
}

/** Resumes an existing session to expire or answer its current round. */
async function continueGame(intent: PlayIntent) {
  const { body, repository, store, playerId } = intent

  const session = body.sessionId ? await store.get(body.sessionId) : null
  if (!session) {
    return data({ error: "Partida caducada. Empieza otra." }, { status: 410 })
  }
  // A session belongs to exactly one player id.
  if (session.playerId !== playerId) {
    return data({ error: "Esta partida no es tuya." }, { status: 403 })
  }

  if (body.action === "expire") {
    const result = await expireRound({ repository, store, session })
    await scoreIfFinished({ repository, store, sessionId: session.id, result })
    return data({ ok: true, result })
  }

  if (body.action === "answer") {
    if (!body.answerId)
      return data({ error: "Falta la respuesta." }, { status: 400 })
    const result = await answerRound({
      repository,
      store,
      session,
      answerId: body.answerId,
      random: Math.random,
    })
    await scoreIfFinished({ repository, store, sessionId: session.id, result })
    return data({ ok: true, result })
  }

  return data({ error: "Acción desconocida." }, { status: 400 })
}

/** Persists the final score once a session has run out of rounds. */
async function scoreIfFinished(input: {
  repository: ContentRepository
  store: SessionStore
  sessionId: string
  result: { finished: boolean }
}) {
  if (!input.result.finished) return
  await recordScore({
    repository: input.repository,
    store: input.store,
    sessionId: input.sessionId,
    finished: true,
  })
}

export function loader() {
  return data({ error: "Usa POST." }, { status: 405 })
}
