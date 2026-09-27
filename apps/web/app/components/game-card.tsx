import { Badge } from "@playloop/ui/components/badge"
import { Play } from "lucide-react"
import { Link } from "react-router"

import { CharacterMark } from "@/components/character-mark"
import type { CatalogueEntry } from "@/lib/catalogue"

const ACCENTS = ["pear", "cyan", "coral", "mint", "lavender"] as const

const TINTS = {
  pear: "bg-primary/35 hover:bg-primary/60",
  cyan: "bg-accent-2/10 hover:bg-accent-2/25",
  coral: "bg-accent-3/10 hover:bg-accent-3/25",
  mint: "bg-mint/10 hover:bg-mint/25",
  lavender: "bg-lavender/10 hover:bg-lavender/25",
} as const satisfies Record<(typeof ACCENTS)[number], string>

export type GameCardProps = {
  game: CatalogueEntry
  index: number
}

/**
 * One catalogue tile. The whole card is the link — no nested interactive
 * elements — so keyboard and pointer get the same affordance.
 */
export function GameCard({ game, index }: Readonly<GameCardProps>) {
  const accent = ACCENTS[index % ACCENTS.length] ?? "pear"

  return (
    <li data-slot="game-card" className="min-w-0">
      <Link
        to={`/game/${game.slug}`}
        className={[
          "group/game flex h-full min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border p-5",
          "transition-[transform,box-shadow,background-color] duration-[var(--dur-base)] ease-[var(--ease-spring)]",
          "hover:-translate-y-1 hover:shadow-[0_18px_44px_-20px_oklch(0.2_0.012_250/0.3)]",
          "transition-all duration-150 active:translate-y-0",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          TINTS[accent],
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <Badge accent={accent}>{game.gameTypeLabel}</Badge>
          {game.expertModeEnabled ? <Badge accent="cyan">Experto</Badge> : null}
        </div>

        <h3 className="min-w-0 font-heading text-xl leading-tight font-bold [overflow-wrap:anywhere]">
          {game.title}
        </h3>

        <p className="line-clamp-2 min-w-0 text-sm text-muted-foreground">
          {game.description ?? "Sin descripción todavía."}
        </p>

        <p className="mt-auto flex items-center gap-2 pt-2 font-label text-[11px] tracking-[0.08em] uppercase">
          <CharacterMark />
          {game.contentCount} elementos
        </p>

        <span className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1.5 text-sm font-semibold whitespace-nowrap">
          <Play aria-hidden="true" className="size-4" />
          Jugar
        </span>
      </Link>
    </li>
  )
}
