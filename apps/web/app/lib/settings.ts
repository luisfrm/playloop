/**
 * Runtime settings the panel owns. They live in `app_setting` as JSON and every
 * one of them has a default, so an empty database behaves like a fresh install
 * and a stored value can always be ignored when it stops making sense.
 *
 * This module stays free of storage so the panel form can import it.
 */
export type AppSettings = {
  /** How many players the ranking of one game shows. */
  rankingSize: number
  /** Hard cap, in characters, for a player name. */
  nameMaxLength: number
  /** Soft ceiling of new sessions per player and minute. */
  startsPerMinute: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  rankingSize: 50,
  nameMaxLength: 24,
  startsPerMinute: 20,
}

export const SETTING_KEYS = Object.keys(
  DEFAULT_SETTINGS
) as (keyof AppSettings)[]

type Range = { min: number; max: number }

export const SETTING_RANGES: Record<keyof AppSettings, Range> = {
  rankingSize: { min: 1, max: 500 },
  nameMaxLength: { min: 2, max: 32 },
  startsPerMinute: { min: 1, max: 600 },
}

export const SETTING_LABELS: Record<keyof AppSettings, string> = {
  rankingSize: "Puestos del ranking",
  nameMaxLength: "Largo máximo del nombre",
  startsPerMinute: "Partidas por minuto",
}

export function inRange(value: number, range: Range): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max
}

export type SettingsFormResult =
  | { ok: true; settings: AppSettings }
  | { ok: false; error: string }

/** Reads the panel form; the first field out of range names itself. */
export function readSettingsForm(form: FormData): SettingsFormResult {
  const settings = { ...DEFAULT_SETTINGS }

  for (const key of SETTING_KEYS) {
    const value = Number(String(form.get(key) ?? "").trim())
    if (!inRange(value, SETTING_RANGES[key])) {
      const { min, max } = SETTING_RANGES[key]
      return {
        ok: false,
        error: `${SETTING_LABELS[key]}: usa un número entero entre ${min} y ${max}.`,
      }
    }
    settings[key] = value
  }

  return { ok: true, settings }
}
