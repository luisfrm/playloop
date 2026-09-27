import type { ContentRepository } from "@playloop/db"
import { gameTypes, type GameInstance } from "@playloop/game-engine"

export type CatalogueEntry = {
  id: string
  slug: string
  title: string
  description: string | null
  gameTypeKey: string
  gameTypeLabel: string
  contentCount: number
  expertModeEnabled: boolean
}

function typeLabel(key: string): string {
  return gameTypes.list().find((type) => type.key === key)?.label ?? key
}

export async function toCatalogueEntry(
  repository: ContentRepository,
  instance: GameInstance
): Promise<CatalogueEntry> {
  const content = await repository.listContent(instance.id)

  return {
    id: instance.id,
    slug: instance.slug,
    title: instance.title,
    description: instance.description ?? null,
    gameTypeKey: instance.gameTypeKey,
    gameTypeLabel: typeLabel(instance.gameTypeKey),
    contentCount: content.length,
    expertModeEnabled: instance.expertModeEnabled,
  }
}

/** Published instances, with everything the catalogue grid needs. */
export async function listCatalogue(
  repository: ContentRepository
): Promise<CatalogueEntry[]> {
  const instances = await repository.listInstances({ publishedOnly: true })
  return Promise.all(
    instances.map((instance) => toCatalogueEntry(repository, instance))
  )
}
