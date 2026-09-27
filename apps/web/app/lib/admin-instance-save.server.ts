import type { ContentRepository } from "@playloop/db"
import {
  parseDictionaryText,
  themeSchema,
  type GameTypeDefinition,
} from "@playloop/game-engine"
import { data } from "react-router"

type Instance = NonNullable<
  Awaited<ReturnType<ContentRepository["getInstanceById"]>>
>

/** What the instance editor posted, plus everything the handlers need. */
export type InstanceSaveIntent = {
  form: FormData
  repository: ContentRepository
  instance: Instance
  definition: GameTypeDefinition
}

/**
 * Routes the editor form to its save handler. The branch table lives here so
 * the route action stays readable and inside the complexity budget (14).
 */
export async function saveInstanceIntent(intent: InstanceSaveIntent) {
  const kind = String(intent.form.get("intent") ?? "")

  if (kind === "settings") return saveSettings(intent)
  if (kind === "content") return saveContent(intent)
  if (kind === "dictionary") return saveDictionary(intent)
  return data({ error: "Acción desconocida." }, { status: 400 })
}

/** Title, description, flags, theme name and the game-type specific settings. */
async function saveSettings({
  form,
  repository,
  instance,
  definition,
}: InstanceSaveIntent) {
  const settingsResult = definition.settingsSchema.safeParse(
    JSON.parse(String(form.get("settingsJson") ?? "{}"))
  )
  if (!settingsResult.success) {
    return data({ error: "La configuración no es válida." }, { status: 400 })
  }

  await repository.saveInstance({
    ...instance,
    title: String(form.get("title") ?? instance.title),
    description: String(form.get("description") ?? ""),
    published: form.get("published") === "on",
    expertModeEnabled: form.get("expertModeEnabled") === "on",
    theme: themeSchema.parse({
      ...instance.theme,
      name: String(form.get("themeName") ?? instance.theme.name),
    }),
    settings: settingsResult.data,
    updatedAt: Date.now(),
  })
  return { ok: true, message: "Configuración guardada." }
}

/** The whole content pool as JSON, validated against the game contract. */
async function saveContent({
  form,
  repository,
  instance,
  definition,
}: InstanceSaveIntent) {
  let payloads: unknown[]
  try {
    payloads = JSON.parse(String(form.get("contentJson") ?? "[]")) as unknown[]
  } catch {
    return data(
      { error: "El contenido enviado no es válido." },
      { status: 400 }
    )
  }

  const validated = definition.contentSchema.array().safeParse(payloads)
  if (!validated.success) {
    return data(
      { error: "Hay elementos con datos inválidos." },
      { status: 400 }
    )
  }

  const saved = await repository.replaceContent(instance.id, validated.data)
  return { ok: true, message: `${saved.length} elementos guardados.` }
}

/** Dictionary lines; saving none while expert mode is on drops the flag. */
async function saveDictionary({
  form,
  repository,
  instance,
}: InstanceSaveIntent) {
  const entries = parseDictionaryText(String(form.get("dictionaryText") ?? ""))
  const saved = await repository.replaceDictionary(instance.id, entries)

  if (instance.expertModeEnabled && saved.length === 0) {
    await repository.saveInstance({
      ...instance,
      expertModeEnabled: false,
      updatedAt: Date.now(),
    })
  }
  return { ok: true, message: `${saved.length} entradas en el diccionario.` }
}
