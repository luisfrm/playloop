import { Button } from "@playloop/ui/components/button"
import { X } from "lucide-react"
import { useEffect, useId, useState } from "react"

import { PlayerNameForm } from "@/components/player-name-form"
import { readPlayer } from "@/lib/player"

/**
 * §13: the catalogue opens by asking who is playing, and only while there is
 * nothing cached — a returning visitor lands straight on the games. It can be
 * dismissed, because the name is also editable from the player menu.
 */
export function PlayerNamePopup() {
  const [open, setOpen] = useState(false)
  const titleId = useId()

  // The cache is read after the first paint, so server render and browser
  // never disagree about what the home shows.
  useEffect(() => {
    setOpen(readPlayer() === null)
  }, [])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  if (!open) return null

  return (
    <div
      data-slot="player-name-popup"
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-background/80 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-[var(--radius-lg)] border bg-card p-6 shadow-[0_18px_44px_-20px_oklch(0.2_0.012_250/0.3)]"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-heading text-xl font-bold">
            ¿Cómo te llamas?
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Se guarda en este dispositivo y es como aparecerás en el ranking.
        </p>

        <div className="mt-4">
          <PlayerNameForm onSaved={() => setOpen(false)} />
        </div>
      </div>
    </div>
  )
}
