import { Button } from "@playloop/ui/components/button"
import { Input } from "@playloop/ui/components/input"
import { data, Form, useLoaderData, useNavigation } from "react-router"

import { requireAdmin } from "@/lib/admin-auth.server"
import { getRepository } from "@/lib/repository.server"
import {
  SETTING_KEYS,
  SETTING_LABELS,
  SETTING_RANGES,
  readSettingsForm,
} from "@/lib/settings"
import { readSettings, writeSettings } from "@/lib/settings.server"

import type { Route } from "./+types/admin-settings"

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireAdmin(request, context)

  const repository = await getRepository(context)
  return { settings: await readSettings(repository) }
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAdmin(request, context)

  const repository = await getRepository(context)
  const parsed = readSettingsForm(await request.formData())
  if (!parsed.ok) return data({ error: parsed.error }, { status: 400 })

  await writeSettings(repository, parsed.settings)
  return { ok: true, message: "Configuración guardada." }
}

export default function AdminConfig() {
  const { settings } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const busy = navigation.state !== "idle"

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b pb-5">
        <h1 className="font-heading text-2xl font-bold">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Límites que valen para toda la plataforma. Se aplican en la siguiente
          petición, sin desplegar nada.
        </p>
      </header>

      <Form method="post" className="flex max-w-md flex-col gap-5">
        {SETTING_KEYS.map((key) => {
          const { min, max } = SETTING_RANGES[key]
          return (
            <div key={key} className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor={`setting-${key}`}>
                {SETTING_LABELS[key]}
              </label>
              <Input
                id={`setting-${key}`}
                name={key}
                type="number"
                min={min}
                max={max}
                step={1}
                defaultValue={settings[key]}
                required
              />
              <p className="text-xs text-muted-foreground">
                Entre {min} y {max}.
              </p>
            </div>
          )
        })}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Guardando…" : "Guardar configuración"}
        </Button>
      </Form>
    </div>
  )
}
