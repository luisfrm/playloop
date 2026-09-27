import { data } from "react-router"

import { getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/api-offline"

type Payload = Record<string, unknown>

/**
 * Everything the client needs to run this instance with no network. Practice
 * only: the response includes the answers by necessity, so the caller must
 * never send a score from here to the ranking.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const repository = await getRepository(context)
  const instance = await repository.getInstanceBySlug(params.slug ?? "")

  if (!instance || !instance.published) {
    return data(
      { error: "Ese juego no existe o no está publicado." },
      { status: 404 }
    )
  }

  const [content, dictionary] = await Promise.all([
    repository.listContent(instance.id),
    repository.listDictionary(instance.id),
  ])

  const mediaUrls = content
    .map((item) => (item.payload as Payload | undefined)?.["mediaUrl"])
    .filter((url): url is string => typeof url === "string")

  return data({
    ok: true,
    instance: {
      instanceId: instance.id,
      slug: instance.slug,
      title: instance.title,
      description: instance.description ?? "",
      gameTypeKey: instance.gameTypeKey,
      settings: instance.settings,
      content: content.map((item) => ({ id: item.id, payload: item.payload })),
      // Shaped exactly like the engine's `DictionaryEntry` so expert mode can
      // resolve locally with the same code the server runs.
      dictionary: dictionary.map((entry) => ({
        id: entry.id,
        gameInstanceId: entry.gameInstanceId,
        value: entry.value,
        aliases: entry.aliases,
      })),
      mediaUrls,
      downloadedAt: Date.now(),
    },
  })
}
