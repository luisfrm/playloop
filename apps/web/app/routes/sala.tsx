import type { RoomPublicState } from "@playloop/game-engine"
import { Badge } from "@playloop/ui/components/badge"
import { Button } from "@playloop/ui/components/button"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"

import { PlayerNameForm } from "@/components/player-name-form"
import { Stat, useCountdown } from "@/components/play-panels"
import { SiteFooter } from "@/components/site-footer"
import { TopNav } from "@/components/top-nav"
import {
  answerRoom,
  connectRoom,
  joinRoom,
  leaveRoom,
  roomFailure,
  startRoom,
  type RoomResponse,
} from "@/lib/coop"
import { hydratePlayer, usePlayer } from "@/lib/player"

type Question = NonNullable<RoomPublicState["question"]>

const PHASE_LABELS: Record<RoomPublicState["phase"], string> = {
  lobby: "Esperando jugadores",
  playing: "En juego",
  finished: "Terminada",
}

/**
 * Cooperative play.
 *
 * The room is authoritative: this screen only renders what the socket publishes
 * and sends the option id the player picked. There is no local score anywhere.
 */
export default function Sala() {
  const { code = "" } = useParams()
  const player = usePlayer()
  const [room, setRoom] = useState<RoomPublicState | null>(null)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const playerId = player?.id ?? ""
  const playerName = player?.name ?? ""

  useEffect(() => {
    hydratePlayer()
  }, [])

  // Join once, as soon as there is a name to join with. A room that is already
  // in play refuses, which is the intended behaviour: no late joins.
  useEffect(() => {
    if (!playerId || playerName.length < 2 || joined) return
    let cancelled = false

    void joinRoom(code, playerId, playerName).then((payload) => {
      if (cancelled) return
      if (!payload.ok) {
        // The room counts the creator from the moment it is created, and a
        // reload finds you in the same seat — `already_joined` means "you are
        // in", not "you were turned away". The room state it sends back is the
        // authoritative one, so enter with it.
        if (payload.reason === "already_joined" && payload.room) {
          setRoom(payload.room)
          setJoined(true)
          return
        }
        setError(roomFailure(payload))
        return
      }
      setRoom(payload.room)
      setJoined(true)
    })

    return () => {
      cancelled = true
    }
  }, [code, joined, playerId, playerName])

  useEffect(() => {
    if (!joined || !playerId) return
    return connectRoom({
      code,
      playerId,
      onState: setRoom,
      onClosed: () => undefined,
    })
  }, [code, joined, playerId])

  const act = useCallback(async (run: () => Promise<RoomResponse>) => {
    setPending(true)
    try {
      const payload = await run()
      if (payload.room) setRoom(payload.room)
      setError(payload.ok ? null : roomFailure(payload))
    } catch {
      setError("No se pudo contactar con la sala.")
    } finally {
      setPending(false)
    }
  }, [])

  const remaining = useCountdown(
    room?.question?.expiresAt ?? null,
    () => undefined
  )
  const standings = useMemo(
    () => (room ? [...room.members].sort((a, b) => b.score - a.score) : []),
    [room]
  )

  return (
    <div className="flex min-h-svh flex-col">
      <TopNav />
      <main className="mx-auto flex w-full max-w-[64rem] flex-1 flex-col gap-6 px-[clamp(1rem,4vw,1.5rem)] py-10">
        <header className="flex flex-col gap-2 border-b pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 font-heading text-3xl font-bold tracking-[-0.025em] [overflow-wrap:anywhere]">
              Sala {code}
            </h1>
            {room ? (
              <Badge accent="cyan">{PHASE_LABELS[room.phase]}</Badge>
            ) : null}
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            Todos responden la misma pregunta a la vez y cada acierto suma un
            punto para quien lo acierta. Hasta 8 jugadores por sala.
          </p>
        </header>

        <RoomNotice error={error} hasPlayer={Boolean(player)} joined={joined} />
        <RoomSection
          room={room}
          joined={joined}
          playerId={playerId}
          pending={pending}
          code={code}
          remaining={remaining}
          standings={standings}
          act={act}
        />
      </main>
      <SiteFooter />
    </div>
  )
}

function Standings({ members }: { members: RoomPublicState["members"] }) {
  const sorted = [...members].sort((a, b) => b.score - a.score)

  return (
    <ol className="flex flex-col gap-2">
      {sorted.map((member, index) => (
        <li
          key={member.playerId}
          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-sm"
        >
          <span className="min-w-0 truncate">
            {index + 1}. {member.name}
            {!member.connected ? (
              <span className="text-muted-foreground"> · desconectado</span>
            ) : null}
          </span>
          <span className="font-heading font-bold">{member.score}</span>
        </li>
      ))}
    </ol>
  )
}

function Lobby(props: {
  room: RoomPublicState
  playerId: string
  pending: boolean
  onStart: () => void
}) {
  const isHost = props.room.hostId === props.playerId

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border bg-card p-6">
      <div className="border-b pb-4">
        <h2 className="font-heading text-xl font-bold">
          {props.room.members.length} en la sala
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Comparte el código{" "}
          <strong className="text-foreground">{props.room.code}</strong> para
          que entren.
        </p>
      </div>

      <Standings members={props.room.members} />

      {isHost ? (
        <Button
          type="button"
          size="lg"
          disabled={props.pending}
          onClick={props.onStart}
        >
          {props.pending ? "Empezando…" : "Empezar la partida"}
        </Button>
      ) : (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          Esperando a que quien creó la sala empiece la partida.
        </p>
      )}
    </div>
  )
}

function QuestionPanel(props: {
  room: RoomPublicState
  question: Question
  remaining: number | null
  playerId: string
  pending: boolean
  onAnswer: (optionId: string) => void
}) {
  const { question } = props
  const answered = question.answeredBy.includes(props.playerId)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="font-label flex flex-wrap gap-5 text-[11px] tracking-[0.08em] uppercase">
          <Stat label="Pregunta" value={props.room.questionCount} />
          <Stat label="Han respondido" value={question.answeredBy.length} />
        </dl>
        {props.remaining !== null ? (
          <Badge accent={props.remaining < 5000 ? "coral" : "neutral"}>
            {Math.ceil(props.remaining / 1000)}s
          </Badge>
        ) : null}
      </div>

      <img
        src={question.prompt.mediaUrl}
        alt=""
        width={800}
        height={500}
        className="aspect-[8/5] w-full rounded-[var(--radius-lg)] border object-cover"
      />
      {question.prompt.caption ? (
        <p className="text-sm text-muted-foreground">
          {question.prompt.caption}
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options.map((option) => (
          <li key={option.id}>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full justify-start whitespace-normal"
              disabled={props.pending || answered}
              onClick={() => props.onAnswer(option.id)}
            >
              {option.label}
            </Button>
          </li>
        ))}
      </ul>

      <p
        role="status"
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        {answered
          ? "Respuesta enviada. Espera a los demás o al final del tiempo."
          : "Elige una opción. Cuando acabe el tiempo la sala pasa sola."}
      </p>

      <div className="border-t pt-4">
        <h2 className="mb-3 font-heading text-lg font-bold">Marcador</h2>
        <Standings members={props.room.members} />
      </div>
    </div>
  )
}

function Results(props: {
  standings: RoomPublicState["members"]
  gameSlug: string
  pending: boolean
  onLeave: () => void
}) {
  const winner = props.standings[0]

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border bg-card p-6">
      <h2 className="font-heading text-2xl font-bold">
        {winner ? `Gana ${winner.name}` : "Partida terminada"}
      </h2>

      <Standings members={props.standings} />

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button size="lg" render={<Link to={`/juego/${props.gameSlug}`} />}>
          Jugar este juego
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={props.pending}
          onClick={props.onLeave}
        >
          Salir de la sala
        </Button>
      </div>
    </div>
  )
}

function RoomNotice(props: {
  error: string | null
  hasPlayer: boolean
  joined: boolean
}) {
  return (
    <>
      {props.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          {props.error}
        </p>
      ) : null}

      {!props.hasPlayer ? (
        <div className="rounded-[var(--radius-lg)] border bg-card p-6">
          <PlayerNameForm />
        </div>
      ) : null}

      {props.hasPlayer && !props.joined ? (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          Entrando en la sala…
        </p>
      ) : null}
    </>
  )
}

/** The lobby, question and results views, picked from the authoritative phase. */
function RoomSection(props: {
  room: RoomPublicState | null
  joined: boolean
  playerId: string
  pending: boolean
  code: string
  remaining: number | null
  standings: RoomPublicState["members"]
  act: (run: () => Promise<RoomResponse>) => Promise<void>
}) {
  const room = props.room
  if (!props.joined || !room) return null

  if (room.phase === "lobby") {
    return (
      <Lobby
        room={room}
        playerId={props.playerId}
        pending={props.pending}
        onStart={() =>
          void props.act(() => startRoom(props.code, props.playerId))
        }
      />
    )
  }

  if (room.phase === "playing" && room.question) {
    return (
      <QuestionPanel
        room={room}
        question={room.question}
        remaining={props.remaining}
        playerId={props.playerId}
        pending={props.pending}
        onAnswer={(optionId) =>
          void props.act(() => answerRoom(props.code, props.playerId, optionId))
        }
      />
    )
  }

  if (room.phase === "finished") {
    return (
      <Results
        standings={props.standings}
        gameSlug={room.gameSlug}
        pending={props.pending}
        onLeave={() =>
          void props.act(() => leaveRoom(props.code, props.playerId))
        }
      />
    )
  }

  return null
}
