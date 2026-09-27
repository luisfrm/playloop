import { GameCard } from "@/components/game-card"
import type { CatalogueEntry } from "@/lib/catalogue"

export type GameListProps = {
  games: CatalogueEntry[]
}

/**
 * The Catalogue grid: identical tiles, four across on wide screens. Tailwind's
 * `grid-cols-*` already emits `repeat(n, minmax(0, 1fr))`, so long titles can
 * never blow the track out.
 */
export function GameList({ games }: GameListProps) {
  return (
    <ul
      data-slot="game-list"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {games.map((game, index) => (
        <GameCard key={game.id} game={game} index={index} />
      ))}
    </ul>
  )
}
