import type { GameTypeDefinition, GameTypeSummary } from "./game-type.js"
import type { BaseSettings } from "./settings.js"

type AnyGameType = GameTypeDefinition<unknown, BaseSettings>

/**
 * The single place that knows which game types exist. Registering a new type is
 * the only step required to make it appear in the admin panel and the runtime.
 */
export class GameTypeRegistry {
  private readonly types = new Map<string, AnyGameType>()

  register<TPayload, TSettings extends BaseSettings>(
    definition: GameTypeDefinition<TPayload, TSettings>
  ): void {
    if (this.types.has(definition.key)) {
      throw new Error(`Game type "${definition.key}" is already registered`)
    }
    this.types.set(definition.key, definition as unknown as AnyGameType)
  }

  has(key: string): boolean {
    return this.types.has(key)
  }

  get(key: string): AnyGameType | undefined {
    return this.types.get(key)
  }

  /** Throwing accessor for server code paths that must have a valid type. */
  require(key: string): AnyGameType {
    const definition = this.types.get(key)
    if (!definition) {
      throw new Error(`Unknown game type "${key}"`)
    }
    return definition
  }

  list(): GameTypeSummary[] {
    return [...this.types.values()]
      .map((definition) => ({
        key: definition.key,
        label: definition.label,
        description: definition.description,
        requiresDictionary: definition.requiresDictionary,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }
}
