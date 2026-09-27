import { Badge } from "@playloop/ui/components/badge"
import { Button } from "@playloop/ui/components/button"
import { Input } from "@playloop/ui/components/input"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"

/**
 * The two panels a session is made of, kept independent of where the score came
 * from. The online flow resolves it on the server; offline practice resolves it
 * in the browser. Both render exactly the same UI.
 */

export type PlayStatsView = {
  score: number
  lives: number
  streak: number
  roundsPlayed: number
}

export type RoundView = {
  answerMode: "classic" | "expert"
  prompt: { mediaUrl: string; caption?: string }
  options: { id: string; label: string }[]
  dictionary: { id: string; value: string }[]
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
  const [query, setQuery] = useState("")
  const remaining = useCountdown(view.selectionDeadlineMs, props.onExpire)

  const options = useMemo<{ id: string; label: string }[]>(() => {
    if (view.answerMode === "classic") return view.options

    const needle = query.trim().toLowerCase()
    return view.dictionary
      .filter((entry) =>
        needle ? entry.value.toLowerCase().includes(needle) : true
      )
      .slice(0, 8)
      .map((entry) => ({ id: entry.id, label: entry.value }))
  }, [query, view.answerMode, view.dictionary, view.options])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="font-label flex flex-wrap gap-5 text-[11px] tracking-[0.08em] uppercase">
          <Stat label="Puntos" value={view.stats.score} />
          <Stat label="Vidas" value={view.stats.lives} />
          <Stat label="Racha" value={view.stats.streak} />
        </dl>
        {remaining !== null ? (
          <Badge accent={remaining < 5000 ? "coral" : "neutral"}>
            {Math.ceil(remaining / 1000)}s
          </Badge>
        ) : null}
      </div>

      <img
        src={view.prompt.mediaUrl}
        alt=""
        width={800}
        height={500}
        className="aspect-[8/5] w-full rounded-[var(--radius-lg)] border object-cover"
      />
      {view.prompt.caption ? (
        <p className="text-sm text-muted-foreground">{view.prompt.caption}</p>
      ) : null}

      {view.answerMode === "expert" ? (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="expert-answer">
            Busca la respuesta en el diccionario
          </label>
          <Input
            id="expert-answer"
            size="lg"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls="expert-options"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Escribe para filtrar…"
          />
          <ul
            id="expert-options"
            role="listbox"
            className="flex flex-col gap-2"
          >
            {options.map((entry) => (
              <li key={entry.id}>
                <Button
                  type="button"
                  role="option"
                  aria-selected={false}
                  variant="outline"
                  size="lg"
                  className="w-full justify-start"
                  disabled={props.busy}
                  onClick={() => props.onAnswer(entry.id)}
                >
                  {entry.label}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <li key={option.id}>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full justify-start whitespace-normal"
                disabled={props.busy}
                onClick={() => props.onAnswer(option.id)}
              >
                {option.label}
              </Button>
            </li>
          ))}
        </ul>
      )}
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
          className="bg-accent-3 pointer-events-none absolute top-6 right-6 size-6 animate-[playloop-star-burst_420ms_ease-out_forwards] [mask-image:linear-gradient(90deg,transparent_47%,black_47%_53%,transparent_53%),linear-gradient(0deg,transparent_47%,black_47%_53%,transparent_53%)]"
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

      <dl className="font-label flex flex-wrap gap-5 text-[11px] tracking-[0.08em] uppercase">
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
