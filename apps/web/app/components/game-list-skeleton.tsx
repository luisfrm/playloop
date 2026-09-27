export type GameListSkeletonProps = {
  count?: number
}

/** Loader placeholder — mirrors the real grid's track sizes exactly. */
export function GameListSkeleton({ count = 4 }: GameListSkeletonProps) {
  return (
    <div
      data-slot="game-list-skeleton"
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <span className="sr-only">Cargando juegos…</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border bg-secondary/40 p-5"
        >
          <div className="h-5 w-24 animate-pulse rounded-full bg-secondary" />
          <div className="h-6 w-3/4 animate-pulse rounded-md bg-secondary" />
          <div className="h-4 w-full animate-pulse rounded-md bg-secondary" />
          <div className="h-4 w-2/3 animate-pulse rounded-md bg-secondary" />
        </div>
      ))}
    </div>
  )
}
