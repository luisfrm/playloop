import { Badge } from "@playloop/ui/components/badge"
import { Button } from "@playloop/ui/components/button"
import { data, Form, useLoaderData, useNavigation } from "react-router"

import { requireAdmin } from "@/lib/admin-auth.server"
import { getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/admin-moderation"

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireAdmin(request, context)

  const repository = await getRepository(context)
  const players = await repository.listPlayersByName("", 100)

  return {
    blockedTerms: (await repository.listBlockedTerms()).join("\n"),
    players: await Promise.all(
      players.map(async (player) => ({
        id: player.id,
        name: player.displayName,
        hidden: await repository.isPlayerHidden(player.id),
      }))
    ),
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAdmin(request, context)

  const form = await request.formData()
  const repository = await getRepository(context)
  const intent = String(form.get("intent") ?? "")

  if (intent === "terms") {
    const terms = String(form.get("blockedTerms") ?? "")
      .split(/\r?\n/)
      .map((term) => term.trim())
      .filter(Boolean)
    await repository.replaceBlockedTerms(terms)
    return { ok: true, message: "Lista de bloqueo guardada." }
  }

  if (intent === "hide") {
    const playerId = String(form.get("playerId") ?? "")
    if (!playerId) return data({ error: "Falta el jugador." }, { status: 400 })
    await repository.setPlayerHidden(
      playerId,
      form.get("hidden") === "true",
      "manual"
    )
    return { ok: true, message: "Moderación aplicada." }
  }

  return data({ error: "Acción desconocida." }, { status: 400 })
}

export default function AdminModeration() {
  const { blockedTerms, players } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const busy = navigation.state !== "idle"

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b pb-5">
        <h1 className="font-heading text-2xl font-bold">
          Ranking y moderación
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El filtro automático actúa al guardar el nombre. Esta vista es el
          respaldo manual.
        </p>
      </header>

      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="terms" />
        <div>
          <h2 className="font-heading text-xl font-bold">Lista de bloqueo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Una palabra por línea. El filtro normaliza mayúsculas, tildes,
            separadores y leetspeak básico antes de comparar.
          </p>
        </div>
        <textarea
          name="blockedTerms"
          rows={6}
          defaultValue={blockedTerms}
          className="w-full rounded-[var(--radius-md)] border bg-card px-3.5 py-2 font-mono text-sm"
        />
        <Button type="submit" size="lg" disabled={busy}>
          Guardar lista
        </Button>
      </Form>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-bold">Nombres registrados</h2>

        {players.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed p-8 text-center text-sm text-muted-foreground">
            Todavía no hay jugadores.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-[var(--radius-lg)] border bg-card">
            {players.map((player) => (
              <li
                key={player.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="min-w-0 truncate font-medium">
                    {player.name || "Sin nombre"}
                  </span>
                  {player.hidden ? <Badge accent="coral">Oculto</Badge> : null}
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="hide" />
                  <input type="hidden" name="playerId" value={player.id} />
                  <input
                    type="hidden"
                    name="hidden"
                    value={player.hidden ? "false" : "true"}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="lg"
                    disabled={busy}
                  >
                    {player.hidden ? "Mostrar" : "Ocultar del ranking"}
                  </Button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
