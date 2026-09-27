import { Button } from "@playloop/ui/components/button"
import { Input } from "@playloop/ui/components/input"
import { Select } from "@playloop/ui/components/select"
import { gameTypes, themeSchema } from "@playloop/game-engine"
import { useState } from "react"
import {
  Form,
  Link,
  data,
  redirect,
  useLoaderData,
  useNavigation,
} from "react-router"

import { requireAdmin } from "@/lib/admin-auth.server"
import { ensureGameTypes } from "@/lib/game-types.server"
import { getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/admin-new"

export async function loader() {
  return { gameTypes: gameTypes.list() }
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAdmin(request, context)

  const form = await request.formData()
  const repository = await getRepository(context)

  const gameTypeKey = String(form.get("gameTypeKey") ?? "")
  const title = String(form.get("title") ?? "").trim()
  const slugInput = String(form.get("slug") ?? "").trim()
  const slug = slugInput || slugify(title)

  if (!gameTypes.has(gameTypeKey)) {
    return data({ error: "Elige un tipo de juego válido." }, { status: 400 })
  }
  if (title.length < 2) {
    return data(
      { error: "El título necesita al menos 2 caracteres." },
      { status: 400 }
    )
  }
  if (await repository.getInstanceBySlug(slug)) {
    return data({ error: "Ese slug ya está en uso." }, { status: 409 })
  }

  const definition = gameTypes.require(gameTypeKey)
  const defaultSettings = definition.settingsSchema.parse({})
  const now = Date.now()

  const instance = {
    id: crypto.randomUUID(),
    slug,
    gameTypeKey,
    title,
    description: String(form.get("description") ?? ""),
    theme: themeSchema.parse({ name: title }),
    settings: defaultSettings,
    published: false,
    expertModeEnabled: false,
    createdAt: now,
    updatedAt: now,
  }

  // `game_instance.game_type_key` references `game_type`, so the mirror of the
  // code registry has to be in place before an instance can be written.
  await ensureGameTypes(repository)
  await repository.saveInstance(instance)
  return redirect(`/admin/games/${instance.id}`)
}

export default function AdminNew() {
  const { gameTypes: types } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const [title, setTitle] = useState("")

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b pb-5">
        <h1 className="font-heading text-2xl font-bold">Nuevo juego</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Primero el tipo y los datos base. El contenido y el diccionario se
          cargan después.
        </p>
      </header>

      <Form
        method="post"
        className="flex max-w-xl flex-col gap-4 rounded-[var(--radius-lg)] border bg-card p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="title">
            Título
          </label>
          <Input
            id="title"
            name="title"
            size="lg"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="slug">
            Slug
          </label>
          <Input
            id="slug"
            name="slug"
            size="lg"
            placeholder={slugify(title) || "mi-juego"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="gameTypeKey">
            Tipo de juego
          </label>
          <Select
            id="gameTypeKey"
            name="gameTypeKey"
            size="lg"
            defaultValue={types[0]?.key}
          >
            {types.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            size="lg"
            disabled={navigation.state !== "idle"}
          >
            Crear juego
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            render={<Link to="/admin" />}
          >
            Cancelar
          </Button>
        </div>
      </Form>
    </div>
  )
}
