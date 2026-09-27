import { data } from "react-router"

import {
  PlayError,
  answerRound,
  expireRound,
  recordScore,
  startSession,
} from "@/lib/play-service.server"
import { getRepository } from "@/lib/repository.server"
import { getSessionStore } from "@/lib/sessions.server"
import { checkName } from "@playloop/game-engine"

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

  const repository = await getRepository(context)
  const store = getSessionStore(context)
  const playerId = body.playerId ?? ""
  if (!playerId) return data({ error: "Falta el jugador." }, { status: 400 })

  const blockedTerms = await repository.listBlockedTerms()
  const rawName = (body.playerName ?? "").trim().slice(0, MAX_NAME_LENGTH)

  if (body.action === "start") {
    if (rawName.length < 2) {
      return data(
        { error: "Necesitas un nombre de al menos 2 caracteres." },
        { status: 400 }
      )
    }
    const decision = checkName(rawName, blockedTerms)
    if (!decision.allowed) {
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
    if (result.finished)
      await recordScore({
        repository,
        store,
        sessionId: session.id,
        finished: true,
      })
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
    if (result.finished)
      await recordScore({
        repository,
        store,
        sessionId: session.id,
        finished: true,
      })
    return data({ ok: true, result })
  }

  return data({ error: "Acción desconocida." }, { status: 400 })
}

export function loader() {
  return data({ error: "Usa POST." }, { status: 405 })
}
