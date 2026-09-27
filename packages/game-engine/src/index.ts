export * from "./primitives.js"
export * from "./theme.js"
export * from "./content.js"
export * from "./dictionary.js"
export * from "./settings.js"
export * from "./game-type.js"
export * from "./game-instance.js"
export * from "./registry.js"
export * from "./descriptor.js"
export * from "./play/session.js"
export * from "./realtime/room.js"
export * from "./moderation/name-filter.js"
export {
  trueFalseGameType,
  trueFalseContentSchema,
  trueFalseSettingsSchema,
} from "./play/types/true-false.js"
export type {
  TrueFalseContent,
  TrueFalseSettings,
} from "./play/types/true-false.js"

import { GameTypeRegistry } from "./registry.js"
import { trueFalseGameType } from "./play/types/true-false.js"

/**
 * The application registry. Adding a game type means writing its schema +
 * validator and registering it here — no panel, route or DB change.
 */
export const gameTypes = new GameTypeRegistry()

gameTypes.register(trueFalseGameType)
