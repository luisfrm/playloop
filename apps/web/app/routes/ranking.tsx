import { Badge } from "@playloop/ui/components/badge"
import { data, Link, useLoaderData } from "react-router"

import { SiteFooter } from "@/components/site-footer"
import { TopNav } from "@/components/top-nav"
import { getRepository } from "@/lib/repository.server"
import { readSettings } from "@/lib/settings.server"

import type { Route } from "./+types/ranking"

export async function loader({ params, context }: Route.LoaderArgs) {
  const repository = await getRepository(context)
  const instance = await repository.getInstanceBySlug(params.slug ?? "")

  if (!instance) {
    throw data({ message: "Ese juego no existe." }, { status: 404 })
  }

  const { rankingSize } = await readSettings(repository)

  return {
    title: instance.title,
    slug: instance.slug,
    rows: await repository.listRanking(instance.id, rankingSize),
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Ranking · ${loaderData?.title ?? "Playloop"}` }]
}

export default function Ranking() {
  const { title, slug, rows } = useLoaderData<typeof loader>()

  return (
    <div className="flex min-h-svh flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-[64rem] flex-1 px-[clamp(1rem,4vw,1.5rem)] py-10">
        <header className="flex flex-col gap-2 border-b pb-6">
          <Badge accent="cyan">Ranking del juego</Badge>
          <h1 className="min-w-0 font-heading text-3xl font-bold tracking-[-0.025em] [overflow-wrap:anywhere]">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Cada juego tiene su propio ranking. Las partidas sin conexión no
            compiten aquí.
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="mt-8 rounded-[var(--radius-lg)] border border-dashed p-10 text-center text-sm text-muted-foreground">
            Todavía no hay puntuaciones.{" "}
            {slug ? (
              <Link className="underline" to={`/juego/${slug}`}>
                Sé el primero
              </Link>
            ) : null}
          </p>
        ) : (
          <ol className="mt-8 flex flex-col divide-y rounded-[var(--radius-lg)] border bg-card">
            {rows.map((row, index) => (
              <li
                key={row.playerId}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="min-w-8 font-label text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="min-w-0 truncate font-heading text-lg font-bold">
                    {row.displayName}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge accent="pear">{row.bestStreak} de racha</Badge>
                  <span className="font-heading text-xl font-bold tabular-nums">
                    {row.score}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
