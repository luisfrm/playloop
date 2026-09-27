import { Badge } from "@playloop/ui/components/badge"
import { Button } from "@playloop/ui/components/button"
import { gameTypes } from "@playloop/game-engine"
import { Link, data, useLoaderData, useNavigation } from "react-router"

import { requireAdmin } from "@/lib/admin-auth.server"
import { getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/admin-index"

export async function loader({ context }: Route.LoaderArgs) {
  const repository = await getRepository(context)
  const instances = await repository.listInstances()

  return {
    gameTypes: gameTypes.list(),
    instances: await Promise.all(
      instances.map(async (instance) => ({
        id: instance.id,
        slug: instance.slug,
        title: instance.title,
        gameTypeKey: instance.gameTypeKey,
        published: instance.published,
        expertModeEnabled: instance.expertModeEnabled,
        contentCount: (await repository.listContent(instance.id)).length,
        dictionaryCount: (await repository.listDictionary(instance.id)).length,
      }))
    ),
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAdmin(request, context)

  const form = await request.formData()
  if (form.get("intent") !== "delete")
    return data({ ok: false }, { status: 400 })

  const repository = await getRepository(context)
  const id = String(form.get("id") ?? "")
  if (id) await repository.deleteInstance(id)

  return { ok: true }
}

export default function AdminIndex() {
  const { instances, gameTypes: types } = useLoaderData<typeof loader>()
  const navigation = useNavigation()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="font-heading text-2xl font-bold">Juegos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada instancia tiene su propio tipo, tema, contenido y diccionario.
          </p>
        </div>
        <Button size="lg" render={<Link to="/admin/nuevo" />}>
          Nuevo juego
        </Button>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-label text-[11px] tracking-[0.1em] uppercase">
          Tipos de juego disponibles
        </h2>
        <ul className="flex flex-wrap gap-2">
          {types.map((type) => (
            <li key={type.key}>
              <Badge accent="lavender">{type.label}</Badge>
            </li>
          ))}
        </ul>
      </section>

      {instances.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todavía no hay juegos. Crea el primero para empezar.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-[var(--radius-lg)] border bg-card">
          {instances.map((instance) => (
            <li
              key={instance.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    to={`/admin/juego/${instance.id}`}
                    className="min-w-0 truncate font-heading text-lg font-bold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {instance.title}
                  </Link>
                  <Badge accent={instance.published ? "mint" : "neutral"}>
                    {instance.published ? "Publicado" : "Borrador"}
                  </Badge>
                  {instance.expertModeEnabled ? (
                    <Badge accent="cyan">Experto</Badge>
                  ) : null}
                </div>
                <p className="font-label text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                  {instance.gameTypeKey} · {instance.contentCount} elementos ·{" "}
                  {instance.dictionaryCount} entradas
                </p>
              </div>

              <form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={instance.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  size="lg"
                  disabled={navigation.state !== "idle"}
                >
                  Eliminar
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
