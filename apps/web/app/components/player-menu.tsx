import { Button } from "@playloop/ui/components/button"
import { User } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { PlayerNameForm } from "@/components/player-name-form"
import { hydratePlayer, usePlayer } from "@/lib/player"

/**
 * The player identity control. Deliberately a disclosure, not a portal-based
 * popover: no client-only dependency, works with keyboard and Escape, and
 * stays inside the top nav's stacking context.
 */
export function PlayerMenu() {
  const player = usePlayer()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    hydratePlayer()
  }, [])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [open])

  const label = player?.name ? `Jugador: ${player.name}` : "Jugador sin nombre"

  return (
    <div ref={containerRef} className="relative" data-slot="player-menu">
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <User aria-hidden="true" />
        <span className="hidden max-w-32 truncate sm:inline">
          {player?.name ?? "Invitado"}
        </span>
        <span className="sr-only">{label}</span>
      </Button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Tu nombre"
          className="absolute right-0 z-50 mt-2 w-72 rounded-[var(--radius-lg)] border bg-popover p-5 text-popover-foreground shadow-[0_18px_44px_-20px_oklch(0.2_0.012_250/0.3)]"
        >
          <PlayerNameForm
            initialName={player?.name ?? ""}
            onSaved={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
