import { Badge } from "@playloop/ui/components/badge"
import { Button } from "@playloop/ui/components/button"
import { Input } from "@playloop/ui/components/input"
import {
  describeObject,
  gameTypes,
  type ObjectDescriptor,
} from "@playloop/game-engine"
import { useState } from "react"
import { Form, Link, data, useLoaderData, useNavigation } from "react-router"

import { requireAdmin } from "@/lib/admin-auth.server"
import { saveInstanceIntent } from "@/lib/admin-instance-save.server"
import { DictionaryImport } from "@/components/dictionary-import"
import { MediaUpload } from "@/components/media-upload"
import { SchemaForm } from "@/components/schema-form"
import { isR2Configured, r2ConfigFromEnv } from "@/lib/r2-presign.server"
import { getEnv, getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/admin-instance"

export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireAdmin(request, context)

  const repository = await getRepository(context)
  const instance = await repository.getInstanceById(params.id ?? "")
  if (!instance)
    throw data({ message: "Ese juego no existe." }, { status: 404 })

  const definition = gameTypes.require(instance.gameTypeKey)
  const settings = definition.settingsSchema.safeParse(instance.settings)
  const env = getEnv(context)

  return {
    /**
     * The schema field that holds this game type's media, straight from its
     * contract. Null when the type has no media: the upload slot hides.
     */
    mediaField: definition.presentation.optionMediaField ?? null,
    /** The panel only offers expert mode and dictionaries to types that need them. */
    requiresDictionary: definition.requiresDictionary,
    uploadsEnabled: isR2Configured(
      r2ConfigFromEnv({
        R2_S3_ENDPOINT: env.R2_S3_ENDPOINT,
        R2_BUCKET: env.R2_BUCKET,
        R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
        MEDIA_PUBLIC_BASE_URL: env.MEDIA_PUBLIC_BASE_URL,
      })
    ),
    instance: {
      id: instance.id,
      title: instance.title,
      slug: instance.slug,
      description: instance.description ?? "",
      published: instance.published,
      expertModeEnabled: instance.expertModeEnabled,
      gameTypeKey: instance.gameTypeKey,
    },
    settingsValue: (settings.success ? settings.data : {}) as Record<
      string,
      unknown
    >,
    settingsDescriptor: describeObject(
      definition.settingsSchema
    ) as ObjectDescriptor,
    contentDescriptor: describeObject(
      definition.contentSchema
    ) as ObjectDescriptor,
    content: (await repository.listContent(instance.id)).map(
      (item) => item.payload
    ),
    dictionaryText: (await repository.listDictionary(instance.id))
      .map((entry) => [entry.value, ...entry.aliases].join(" | "))
      .join("\n"),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

/** Read a text field off a content payload without trusting its shape. */
function stringField(source: Record<string, unknown>, field: string): string {
  const value = source[field]
  return typeof value === "string" ? value : ""
}

export async function action({ request, params, context }: Route.ActionArgs) {
  await requireAdmin(request, context)

  const form = await request.formData()
  const repository = await getRepository(context)
  const instance = await repository.getInstanceById(params.id ?? "")
  if (!instance)
    throw data({ message: "Ese juego no existe." }, { status: 404 })

  return saveInstanceIntent({
    form,
    repository,
    instance,
    definition: gameTypes.require(instance.gameTypeKey),
  })
}

export default function AdminInstance() {
  const loaderData = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const busy = navigation.state !== "idle"

  const [settings, setSettings] = useState<Record<string, unknown>>(
    loaderData.settingsValue
  )
  const [content, setContent] = useState<Record<string, unknown>[]>(
    loaderData.content.map(asRecord)
  )
  const [dictionaryText, setDictionaryText] = useState(
    loaderData.dictionaryText
  )

  const canEnableExpert = loaderData.dictionaryText.trim().length > 0
  const mediaField = loaderData.mediaField

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 font-heading text-2xl font-bold [overflow-wrap:anywhere]">
              {loaderData.instance.title}
            </h1>
            <Badge accent="lavender">{loaderData.instance.gameTypeKey}</Badge>
          </div>
          <p className="mt-1 font-label text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            /game/{loaderData.instance.slug}
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          render={<Link to={`/game/${loaderData.instance.slug}`} />}
        >
          Ver juego
        </Button>
      </header>

      <Form method="post">
        <input type="hidden" name="intent" value="settings" />
        <input
          type="hidden"
          name="settingsJson"
          value={JSON.stringify(settings)}
        />
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="title">
                Título
              </label>
              <Input
                id="title"
                name="title"
                size="lg"
                defaultValue={loaderData.instance.title}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="themeName">
                Nombre del tema
              </label>
              <Input
                id="themeName"
                name="themeName"
                size="lg"
                defaultValue={loaderData.instance.title}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="description">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={loaderData.instance.description}
              className="w-full rounded-[var(--radius-md)] border bg-card px-3.5 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="published"
                defaultChecked={loaderData.instance.published}
                className="size-4 accent-[var(--primary)]"
              />
              Publicado
            </label>
            {loaderData.requiresDictionary ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="expertModeEnabled"
                  defaultChecked={loaderData.instance.expertModeEnabled}
                  disabled={!canEnableExpert}
                  className="size-4 accent-[var(--primary)]"
                />
                Modo experto
                {!canEnableExpert ? (
                  <span className="text-xs text-muted-foreground">
                    (requiere diccionario)
                  </span>
                ) : null}
              </label>
            ) : null}
          </div>

          <SchemaForm
            title="Ajustes de la instancia"
            description="Generados desde el schema del tipo de juego. Añadir un tipo nuevo no toca este panel."
            descriptor={loaderData.settingsDescriptor}
            value={settings}
            onChange={setSettings}
            submitLabel="Guardar ajustes"
            busy={busy}
          />
        </div>
      </Form>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <h2 className="font-heading text-xl font-bold">Contenido</h2>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setContent((items) => [...items, { isTrue: true }])}
          >
            Añadir elemento
          </Button>
        </div>

        <Form method="post" className="flex flex-col gap-4">
          <input type="hidden" name="intent" value="content" />
          <input
            type="hidden"
            name="contentJson"
            value={JSON.stringify(content)}
          />

          {content.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed p-8 text-center text-sm text-muted-foreground">
              Todavía no hay elementos. Añade el primero.
            </p>
          ) : (
            <ul className="flex flex-col gap-5">
              {content.map((item, index) => (
                <li key={index} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-label text-[11px] tracking-[0.1em] uppercase">
                      Elemento {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setContent((items) =>
                          items.filter((_, i) => i !== index)
                        )
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                  <SchemaForm
                    title={`Datos del elemento ${index + 1}`}
                    descriptor={loaderData.contentDescriptor}
                    value={item}
                    onChange={(next) =>
                      setContent((items) =>
                        items.map((current, i) =>
                          i === index ? next : current
                        )
                      )
                    }
                  />
                  {mediaField ? (
                    <MediaUpload
                      instanceId={loaderData.instance.id}
                      field={mediaField}
                      currentUrl={stringField(item, mediaField)}
                      enabled={loaderData.uploadsEnabled}
                      onUploaded={(url) =>
                        setContent((items) =>
                          items.map((current, i) =>
                            i === index
                              ? { ...current, [mediaField]: url }
                              : current
                          )
                        )
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <Button type="submit" size="lg" disabled={busy}>
            Guardar contenido
          </Button>
        </Form>
      </section>

      {loaderData.requiresDictionary ? (
        <Form method="post" className="flex flex-col gap-4">
          <input type="hidden" name="intent" value="dictionary" />
          <div className="border-b pb-4">
            <h2 className="font-heading text-xl font-bold">Diccionario</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Una entrada por línea. Los alias van separados por <code>|</code>.
              El modo experto autocompleta solo con estas entradas.
            </p>
          </div>
          <textarea
            name="dictionaryText"
            rows={8}
            value={dictionaryText}
            onChange={(event) => setDictionaryText(event.target.value)}
            className="w-full rounded-[var(--radius-md)] border bg-card px-3.5 py-2 font-mono text-sm"
            placeholder={"Elemento Uno | Uno | 1\nElemento Dos"}
          />
          <DictionaryImport onLoaded={setDictionaryText} />
          <Button type="submit" size="lg" disabled={busy}>
            Guardar diccionario
          </Button>
        </Form>
      ) : null}
    </div>
  )
}
