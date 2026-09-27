import type { ContentRepository } from "@playloop/db"
import { gameTypes } from "@playloop/game-engine"

/**
 * The code registry is the source of truth for which game types exist; the
 * `game_type` table is a mirror of it, and `game_instance.game_type_key`
 * references that table.
 *
 * So the mirror has to be filled *before* an instance is written: creating a
 * game without this step fails the foreign key. It lives on the write path
 * rather than inside `getRepository`, because reading must never write.
 *
 * Runs over every registered type so the mirror also picks up a renamed label.
 * Rewriting a row never moves `registeredAt` — the repository keeps the moment
 * the type first appeared.
 */
export async function ensureGameTypes(
  repository: ContentRepository
): Promise<void> {
  const registeredAt = Date.now()

  for (const type of gameTypes.list()) {
    await repository.saveGameType({ ...type, registeredAt })
  }
}
