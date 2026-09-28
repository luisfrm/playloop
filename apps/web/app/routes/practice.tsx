import { Badge } from "@playloop/ui/components/badge"
import { Button } from "@playloop/ui/components/button"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { Link, useLoaderData, useParams } from "react-router"

import { FeedbackPanel, RoundPanel } from "@/components/play-panels"
import { SiteFooter } from "@/components/site-footer"
import { TopNav } from "@/components/top-nav"
import { loadOfflineInstance, removeOfflineInstance } from "@/lib/offline"
import {
  answerPractice,
  expirePractice,
  practiceView,
  startPractice,
  type PracticeAnswer,
  type PracticeState,
} from "@/lib/practice"

import type { Route } from "./+types/practice"

/**
 * Client-only on purpose: a downloaded game has to be playable with no network,
 * so the data comes from IndexedDB and the whole board loop runs here. Nothing
 * about this page may depend on a server loader.
 */
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return { instance: await loadOfflineInstance(params.slug ?? "") }
}

export function HydrateFallback() {
  return (
    <PracticeShell>
      <p className="text-sm text-muted-foreground">
        Buscando el juego descargado…
      </p>
    </PracticeShell>
  )
}

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Práctica · ${params.slug ?? "Playloop"}` }]
}

type Phase = "idle" | "playing" | "finished"

export default function Practice() {
  const { instance } = useLoaderData<typeof clientLoader>()
  const { slug = "" } = useParams()
  const [phase, setPhase] = useState<Phase>("idle")
  const [state, setState] = useState<PracticeState | null>(null)
  const [lastCorrect, setLastCorrect] = useState(false)

  const view = useMemo(() => (state ? practiceView(state) : null), [state])

  const start = useCallback(() => {
    if (!instance) return
    const started = startPractice(instance)
    setState(started)
    setLastCorrect(false)
    setPhase(started ? "playing" : "idle")
  }, [instance])

  const apply = useCallback((outcome: PracticeAnswer) => {
    setState(outcome.state)
    setLastCorrect(outcome.correct)
    setPhase(outcome.state.finished ? "finished" : "playing")
  }, [])

  const answer = useCallback(
    (answerId: string) => {
      if (state && !state.finished) apply(answerPractice(state, answerId))
    },
    [apply, state]
  )

  const expire = useCallback(() => {
    if (state && !state.finished) apply(expirePractice(state))
  }, [apply, state])

  if (!instance) {
    return (
      <PracticeShell>
        <p className="text-sm text-muted-foreground">
          Este juego no está descargado en este dispositivo.
        </p>
        <Button size="lg" render={<Link to={`/game/${slug}`} />}>
          Ver el juego
        </Button>
      </PracticeShell>
    )
  }

  return (
    <PracticeShell>
      <header className="flex flex-col gap-2 border-b pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 font-heading text-3xl font-bold tracking-[-0.025em] [overflow-wrap:anywhere]">
            {instance.title}
          </h1>
          <Badge accent="coral">Práctica sin conexión</Badge>
        </div>
        <p className="max-w-[52ch] text-sm text-muted-foreground">
          {instance.description}
        </p>
        <p className="max-w-[52ch] text-xs text-muted-foreground">
          Se juega con lo descargado en este dispositivo, sin tocar el servidor.
          Las partidas de práctica no entran al ranking.
        </p>
      </header>

      <section className="pt-8">
        {phase === "idle" ? (
          <StartPanel
            slug={instance.slug}
            contentSize={instance.content.length}
            onStart={start}
          />
        ) : null}

        {phase === "playing" && view ? (
          <RoundPanel
            view={view}
            busy={false}
            onAnswer={answer}
            onExpire={expire}
          />
        ) : null}

        {phase === "finished" && view ? (
          <FeedbackPanel
            stats={view.stats}
            correct={lastCorrect}
            revealedLabel=""
            finished
            busy={false}
            rankingHref={null}
            onContinue={() => {
              setState(null)
              setPhase("idle")
            }}
            onRestart={() => {
              setState(null)
              setPhase("idle")
            }}
          />
        ) : null}
      </section>
    </PracticeShell>
  )
}

function PracticeShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <TopNav />
      <main className="mx-auto flex w-full max-w-[64rem] flex-1 flex-col gap-6 px-[clamp(1rem,4vw,1.5rem)] py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

function StartPanel(props: {
  slug: string
  contentSize: number
  onStart: () => void
}) {
  const [removed, setRemoved] = useState(false)

  if (props.contentSize < 2) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed p-8 text-center text-sm text-muted-foreground">
        La descarga no tiene contenido suficiente para jugar.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        Marca todos los elementos verdaderos del tablero. Cada falso cuesta una
        vida; completar el tablero suma 2 puntos extra.
      </p>

      <Button type="button" size="lg" onClick={props.onStart}>
        Empezar
      </Button>

      <div className="flex flex-col gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={removed}
          onClick={() => {
            void removeOfflineInstance(props.slug)
            setRemoved(true)
          }}
        >
          {removed ? "Descarga eliminada" : "Quitar la descarga"}
        </Button>
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-muted-foreground"
        >
          {removed
            ? "El juego ya no está disponible sin conexión en este dispositivo."
            : "Se puede volver a descargar desde la página del juego."}
        </p>
      </div>
    </div>
  )
}
