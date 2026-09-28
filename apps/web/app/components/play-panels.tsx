import { Badge } from "@playloop/ui/components/badge"
import { Button } from "@playloop/ui/components/button"
import { Check, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router"

/**
 * The board a session is made of, kept independent of where the score came
 * from. The online flow resolves it on the server; offline practice resolves
 * it in the browser. Both render exactly the same UI.
 */

export type PlayStatsView = {
  score: number
  lives: number
  streak: number
  roundsPlayed: number
}

export type BoardChipView = {
  id: string
  label: string
  mediaUrl: string
  caption?: string
  resolved: "true" | "false" | null
}

export type RoundView = {
  board: BoardChipView[]
  found: number
  total: number
  stats: PlayStatsView
  selectionDeadlineMs: number | null
}

export function useCountdown(deadline: number | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (deadline === null) {
      setRemaining(null)
      return
    }
    const tick = () => {
      const left = Math.max(0, deadline - Date.now())
      setRemaining(left)
      if (left === 0) onExpire()
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [deadline, onExpire])

  return remaining
}

export function RoundPanel(props: {
  view: RoundView
  busy: boolean
  onAnswer: (answerId: string) => void
  onExpire: () => void
}) {
  const { view } = props
  const remaining = useCountdown(view.selectionDeadlineMs, props.onExpire)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap gap-5 font-label text-[11px] tracking-[0.08em] uppercase">
          <Stat label="Puntos" value={view.stats.score} />
          <Stat label="Vidas" value={view.stats.lives} />
          <Stat label="Racha" value={view.stats.streak} />
          <Stat label="Encontrados" value={view.found} />
        </dl>
        {remaining !== null ? (
          <Badge accent={remaining < 5000 ? "coral" : "neutral"}>
            {Math.ceil(remaining / 1000)}s
          </Badge>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Marca todos los verdaderos: {view.found} de {view.total}. Cada falso
        cuesta una vida.
      </p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {view.board.map((chip) => (
          <li key={chip.id}>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={
                chip.resolved === "true"
                  ? "w-full justify-start border-success bg-success/10 whitespace-normal"
                  : chip.resolved === "false"
                    ? "w-full justify-start border-destructive bg-destructive/10 whitespace-normal"
                    : "w-full justify-start whitespace-normal"
              }
              disabled={props.busy || chip.resolved !== null}
              aria-pressed={chip.resolved === "true"}
              onClick={() => props.onAnswer(chip.id)}
            >
              {chip.resolved === "true" ? (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              ) : chip.resolved === "false" ? (
                <X aria-hidden="true" className="size-4 shrink-0" />
              ) : null}
              {chip.mediaUrl ? (
                <img
                  src={chip.mediaUrl}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  className="size-10 shrink-0 rounded-[var(--radius-md)] border object-cover"
                />
              ) : null}
              <span className="flex min-w-0 flex-col items-start gap-1">
                <span className="[overflow-wrap:anywhere]">{chip.label}</span>
                {chip.caption ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {chip.caption}
                  </span>
                ) : null}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-bold">{value}</dd>
    </div>
  )
}

export function FeedbackPanel(props: {
  stats: PlayStatsView
  correct: boolean
  revealedLabel: string
  finished: boolean
  busy: boolean
  /** `null` hides the ranking link: practice sessions never reach it. */
  rankingHref: string | null
  onContinue: () => void
  onRestart: () => void
}) {
  return (
    <div className="relative flex flex-col gap-5 rounded-[var(--radius-lg)] border bg-card p-6">
      {props.correct ? (
        <span
          aria-hidden="true"
          data-slot="star-burst"
          className="pointer-events-none absolute top-6 right-6 size-6 animate-[playloop-star-burst_420ms_ease-out_forwards] bg-accent-3 [mask-image:linear-gradient(90deg,transparent_47%,black_47%_53%,transparent_53%),linear-gradient(0deg,transparent_47%,black_47%_53%,transparent_53%)]"
        />
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className="font-heading text-2xl font-bold"
      >
        {props.correct ? "Correcto" : "Fallaste"}
      </p>
      {props.revealedLabel ? (
        <p className="text-sm text-muted-foreground">
          La respuesta era{" "}
          <strong className="text-foreground">{props.revealedLabel}</strong>.
        </p>
      ) : null}

      <dl className="flex flex-wrap gap-5 font-label text-[11px] tracking-[0.08em] uppercase">
        <Stat label="Puntos" value={props.stats.score} />
        <Stat label="Vidas" value={props.stats.lives} />
        <Stat label="Ronda" value={props.stats.roundsPlayed} />
      </dl>

      {props.finished ? (
        <div className="flex flex-wrap gap-2">
          {props.rankingHref ? (
            <Button size="lg" render={<Link to={props.rankingHref} />}>
              Ver ranking
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={props.onRestart}
          >
            Jugar otra vez
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          disabled={props.busy}
          onClick={props.onContinue}
        >
          {props.busy ? "…" : "Siguiente"}
        </Button>
      )}
    </div>
  )
}
