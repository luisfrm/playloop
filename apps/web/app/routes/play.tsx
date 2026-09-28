import { Badge } from "@playloop/ui/components/badge"
import { Button } from "@playloop/ui/components/button"
import { useCallback, useEffect, useState } from "react"
import { Link, data, useLoaderData, useNavigate } from "react-router"

import { FeedbackPanel, RoundPanel } from "@/components/play-panels"
import { SiteFooter } from "@/components/site-footer"
import { TopNav } from "@/components/top-nav"
import { createRoom } from "@/lib/coop"
import { saveOfflineInstance } from "@/lib/offline"
import type { AnswerResponse, PlayView } from "@/lib/play-service.server"
import { hydratePlayer, usePlayer } from "@/lib/player"
import { getEnv, getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/play"

export async function loader({ params, context }: Route.LoaderArgs) {
  const repository = await getRepository(context)
  const instance = await repository.getInstanceBySlug(params.slug ?? "")

  if (!instance || !instance.published) {
    throw data(
      { message: "Ese juego no existe o no está publicado." },
      { status: 404 }
    )
  }

  const content = await repository.listContent(instance.id)

  return {
    title: instance.title,
    description: instance.description ?? "",
    slug: instance.slug,
    contentSize: content.length,
    canPlay: content.length >= 2,
    /** Cooperative play needs a Durable Object binding, absent in memory-only dev. */
    coopAvailable: Boolean(getEnv(context).ROOMS),
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.title ?? "Juego"
  return [{ title: `${title} · Playloop` }]
}

type Phase = "idle" | "playing" | "finished"

type PlayError = { error?: string }

async function postPlay(
  body: Record<string, unknown>
): Promise<
  PlayError & { ok?: boolean; view?: PlayView; result?: AnswerResponse }
> {
  const response = await fetch("/api/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return (await response.json()) as PlayError & {
    ok?: boolean
    view?: PlayView
    result?: AnswerResponse
  }
}

export default function Play() {
  const loaderData = useLoaderData<typeof loader>()
  const player = usePlayer()

  const [phase, setPhase] = useState<Phase>("idle")
  const [view, setView] = useState<PlayView | null>(null)
  const [result, setResult] = useState<AnswerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  )
  const [coop, setCoop] = useState<"idle" | "creating">("idle")
  const navigate = useNavigate()

  useEffect(() => {
    hydratePlayer()
  }, [])

  const playerId = player?.id ?? ""
  const playerName = player?.name ?? ""

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true)
      try {
        const payload = await postPlay({
          ...body,
          playerId,
          playerName: player?.name ?? "",
        })
        if (payload.error) {
          setError(payload.error)
          return payload
        }
        setError(null)
        return payload
      } catch {
        setError("No se pudo contactar con el servidor.")
        return {}
      } finally {
        setBusy(false)
      }
    },
    [player?.name, playerId]
  )

  const start = useCallback(async () => {
    const payload = await send({ action: "start", slug: loaderData.slug })
    if (payload.view) {
      setView(payload.view)
      setResult(null)
      setPhase("playing")
    }
  }, [loaderData.slug, send])

  const applyResult = useCallback((answer: AnswerResponse) => {
    setView(answer.view)
    setResult(answer)
    setPhase(answer.finished ? "finished" : "playing")
  }, [])

  const answer = useCallback(
    async (answerId: string) => {
      const payload = await send({
        action: "answer",
        sessionId: view?.sessionId,
        answerId,
      })
      if (!payload.result) return
      applyResult(payload.result)
    },
    [applyResult, send, view?.sessionId]
  )

  const downloadForOffline = useCallback(async () => {
    setOffline("saving")
    try {
      const response = await fetch(`/api/offline/${loaderData.slug}`)
      const payload = (await response.json()) as {
        ok?: boolean
        instance?: unknown
      }
      if (!payload.ok || !payload.instance) throw new Error("download failed")
      await saveOfflineInstance(
        payload.instance as Parameters<typeof saveOfflineInstance>[0]
      )
      setOffline("saved")
    } catch {
      setOffline("error")
    }
  }, [loaderData.slug])

  const startCoop = useCallback(async () => {
    if (playerName.trim().length < 2) {
      setError("Escribe tu nombre en el menú de jugador para crear una sala.")
      return
    }

    setCoop("creating")
    const created = await createRoom({
      slug: loaderData.slug,
      playerId,
      playerName,
    })
    setCoop("idle")

    if (!created.ok) {
      setError(created.message)
      return
    }
    setError(null)
    await navigate(`/room/${created.code}`)
  }, [loaderData.slug, navigate, playerId, playerName])

  const expire = useCallback(async () => {
    if (!view) return
    const payload = await send({ action: "expire", sessionId: view.sessionId })
    if (!payload.result) return
    applyResult(payload.result)
  }, [applyResult, send, view])

  return (
    <div className="flex min-h-svh flex-col">
      <TopNav />
      <PlayStage
        loaderData={loaderData}
        phase={phase}
        view={view}
        result={result}
        error={error}
        busy={busy}
        offline={offline}
        coop={coop}
        onStart={start}
        onAnswer={answer}
        onExpire={expire}
        onDownload={downloadForOffline}
        onStartCoop={startCoop}
        onRestart={() => {
          setView(null)
          setResult(null)
          setPhase("idle")
        }}
      />
      <SiteFooter />
    </div>
  )
}

type PlayLoaderData = Awaited<ReturnType<typeof loader>>

/** Everything the screen shows once the player is in: header, notices, stage. */
function PlayStage(props: {
  loaderData: PlayLoaderData
  phase: Phase
  view: PlayView | null
  result: AnswerResponse | null
  error: string | null
  busy: boolean
  offline: "idle" | "saving" | "saved" | "error"
  coop: "idle" | "creating"
  onStart: () => void
  onAnswer: (answerId: string) => void
  onExpire: () => void
  onDownload: () => void
  onStartCoop: () => void
  onRestart: () => void
}) {
  return (
    <main className="mx-auto w-full max-w-[64rem] flex-1 px-[clamp(1rem,4vw,1.5rem)] py-10">
      <header className="flex flex-col gap-2 border-b pb-6">
        <h1 className="min-w-0 font-heading text-3xl font-bold tracking-[-0.025em] [overflow-wrap:anywhere]">
          {props.loaderData.title}
        </h1>
        <p className="max-w-[52ch] text-sm text-muted-foreground">
          {props.loaderData.description}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge accent="pear">{props.loaderData.contentSize} elementos</Badge>
        </div>
      </header>

      {props.error ? (
        <p
          role="alert"
          className="mt-6 rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          {props.error}
        </p>
      ) : null}

      <section className="pt-8">
        {props.phase === "idle" ? (
          <StartPanel
            slug={props.loaderData.slug}
            canPlay={props.loaderData.canPlay}
            onStart={props.onStart}
            busy={props.busy}
            offline={props.offline}
            onDownload={props.onDownload}
            coopAvailable={props.loaderData.coopAvailable}
            coop={props.coop}
            onStartCoop={props.onStartCoop}
          />
        ) : null}

        {props.phase === "playing" && props.view ? (
          <RoundPanel
            view={props.view}
            busy={props.busy}
            onAnswer={props.onAnswer}
            onExpire={props.onExpire}
          />
        ) : null}

        {props.phase === "finished" && props.view ? (
          <FeedbackStage
            view={props.view}
            result={props.result}
            busy={props.busy}
            rankingHref={`/ranking/${props.loaderData.slug}`}
            onRestart={props.onRestart}
          />
        ) : null}
      </section>
    </main>
  )
}

/** The final board, with the score and the way out. */
function FeedbackStage(props: {
  view: PlayView
  result: AnswerResponse | null
  busy: boolean
  rankingHref: string
  onRestart: () => void
}) {
  return (
    <FeedbackPanel
      stats={props.view.stats}
      correct={props.result?.correct ?? false}
      revealedLabel=""
      finished
      busy={props.busy}
      rankingHref={props.rankingHref}
      onContinue={props.onRestart}
      onRestart={props.onRestart}
    />
  )
}

function StartPanel(props: {
  slug: string
  canPlay: boolean
  onStart: () => void
  busy: boolean
  offline: "idle" | "saving" | "saved" | "error"
  onDownload: () => void
  coopAvailable: boolean
  coop: "idle" | "creating"
  onStartCoop: () => void
}) {
  if (!props.canPlay) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed p-8 text-center text-sm text-muted-foreground">
        Este juego todavía no tiene contenido suficiente. Añádelo desde el
        panel.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        Marca todos los elementos verdaderos del tablero. Cada falso cuesta una
        vida; completar el tablero suma 2 puntos extra.
      </p>

      <Button
        type="button"
        size="lg"
        disabled={props.busy}
        onClick={props.onStart}
      >
        {props.busy ? "Preparando…" : "Empezar"}
      </Button>

      <div className="flex flex-col gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={props.offline === "saving"}
          onClick={props.onDownload}
        >
          {props.offline === "saving"
            ? "Descargando…"
            : "Descargar para jugar sin conexión"}
        </Button>
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-muted-foreground data-[state=error]:text-destructive"
          data-state={props.offline}
        >
          {props.offline === "saved"
            ? "Descargado. Se juega en modo práctica: no entra al ranking."
            : props.offline === "error"
              ? "No se pudo descargar el juego."
              : "Se guarda el contenido y las imágenes en este dispositivo. Las partidas sin conexión no compiten en el ranking."}
        </p>
        {props.offline === "saved" ? (
          <Button
            variant="outline"
            size="lg"
            render={<Link to={`/practice/${props.slug}`} />}
          >
            Jugar sin conexión
          </Button>
        ) : null}
      </div>

      {props.coopAvailable ? (
        <div className="flex flex-col gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={props.coop === "creating"}
            onClick={props.onStartCoop}
          >
            {props.coop === "creating"
              ? "Creando la sala…"
              : "Jugar con amigos"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Crea una sala y comparte el código. Todos responden la misma
            pregunta a la vez.
          </p>
        </div>
      ) : null}
    </div>
  )
}
