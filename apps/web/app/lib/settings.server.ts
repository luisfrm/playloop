import type { ContentRepository } from "@playloop/db"

import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  SETTING_RANGES,
  inRange,
  type AppSettings,
} from "./settings"

/** A stored value only wins when it is still a valid number for its range. */
function asSetting(value: unknown, key: keyof AppSettings): number {
  return typeof value === "number" && inRange(value, SETTING_RANGES[key])
    ? value
    : DEFAULT_SETTINGS[key]
}

export async function readSettings(
  repository: ContentRepository
): Promise<AppSettings> {
  const stored = await repository.listSettings()
  return {
    rankingSize: asSetting(stored.rankingSize, "rankingSize"),
    nameMaxLength: asSetting(stored.nameMaxLength, "nameMaxLength"),
    startsPerMinute: asSetting(stored.startsPerMinute, "startsPerMinute"),
  }
}

export async function writeSettings(
  repository: ContentRepository,
  settings: AppSettings
): Promise<void> {
  await Promise.all(
    SETTING_KEYS.map((key) => repository.saveSetting(key, settings[key]))
  )
}
