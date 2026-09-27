import { useNavigation } from "react-router"

import { GameList } from "@/components/game-list"
import { GameListSkeleton } from "@/components/game-list-skeleton"
import { PlayerNamePopup } from "@/components/player-name-popup"
import { SiteFooter } from "@/components/site-footer"
import { TopNav } from "@/components/top-nav"
import { listCatalogue } from "@/lib/catalogue"
import { getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/home"

export async function loader({ context }: Route.LoaderArgs) {
  const repository = await getRepository(context)
  const games = await listCatalogue(repository)
  return { games }
}

export function meta() {
  return [
    { title: "Playloop · catálogo de juegos" },
    {
      name: "description",
      content:
        "Catálogo de juegos de Playloop. Sin registro, ranking por juego.",
    },
  ]
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

function inventoryLine(count: number, now: Date): string {
  const month = MONTHS[now.getMonth()] ?? ""
  return `${count} ${count === 1 ? "juego" : "juegos"} · ${month} ${now.getFullYear()} · sin registro`
}

/**
 * Macrostructure: Catalogue — brand mark + tagline only, a grid of identical
 * tiles, no hero display and no global CTA. The inventory header states the
 * count, the month and the qualifier; nothing else.
 */
export default function Home({ loaderData }: Route.ComponentProps) {
  const { games } = loaderData
  const navigation = useNavigation()
  const isLoading = navigation.state === "loading"

  return (
    <div className="flex min-h-svh flex-col">
      {/* §13: asked before anything else, and only without a cached name. */}
      <PlayerNamePopup />
      <TopNav />

      <main className="mx-auto w-full max-w-[80rem] flex-1 px-[clamp(1rem,4vw,1.5rem)] py-10">
        <section className="flex flex-col gap-2 border-b pb-6">
          <h1 className="min-w-0 font-heading text-3xl font-bold tracking-[-0.025em] [overflow-wrap:anywhere] sm:text-4xl">
            {inventoryLine(games.length, new Date())}
          </h1>
          <p className="max-w-[52ch] text-sm text-muted-foreground">
            Elige un juego, deja tu nombre y entra al ranking. Todo el contenido
            se carga desde el panel: el motor no sabe de qué trata ningún juego.
          </p>
        </section>

        <section className="pt-8">
          {isLoading ? (
            <GameListSkeleton />
          ) : games.length > 0 ? (
            <GameList games={games} />
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-dashed p-10 text-center">
              <p className="font-heading text-lg font-bold">
                Todavía no hay juegos publicados
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crea una instancia en el panel y publícala para que aparezca
                aquí.
              </p>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
