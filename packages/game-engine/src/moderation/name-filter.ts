/**
 * First line of defence for ranking names: normalise, then compare against a
 * configurable block list. The manual moderation panel is the backup for
 * anything this does not catch.
 */

const LEETSPEAK: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
}

/**
 * Lowercase, drop accents, collapse separators and undo basic leetspeak so
 * "M4r1c0n" and "marí.con" normalise to the same key.
 */
export function normalizeForModeration(input: string): string {
  const decomposed = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return [...decomposed]
    .map((char) => {
      if (LEETSPEAK[char]) return LEETSPEAK[char]
      return /[a-z]/.test(char) ? char : " "
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

/** Squash the normalised form so separators cannot dodge the list. */
export function moderationKey(input: string): string {
  return normalizeForModeration(input).replace(/ /g, "")
}

export type ModerationDecision =
  | { allowed: true; normalized: string }
  | { allowed: false; normalized: string; matched: string }

export function checkName(
  input: string,
  blockedTerms: readonly string[]
): ModerationDecision {
  const normalized = normalizeForModeration(input)
  const key = moderationKey(input)

  const matched = blockedTerms.find((term) => {
    const blocked = moderationKey(term)
    return blocked.length > 0 && key.includes(blocked)
  })

  return matched
    ? { allowed: false, normalized, matched }
    : { allowed: true, normalized }
}

export type NameRules = {
  minLength: number
  maxLength: number
  blockedTerms: readonly string[]
  fallback: string
}

export const DEFAULT_NAME_RULES: NameRules = {
  minLength: 2,
  maxLength: 24,
  blockedTerms: [],
  fallback: "Jugador",
}

export type NameValidation =
  | { ok: true; name: string }
  | { ok: false; reason: "too_short" | "too_long" | "blocked"; message: string }

/** Full gate used before a name is ever written to the ranking. */
export function validateName(
  raw: string,
  rules: NameRules = DEFAULT_NAME_RULES
): NameValidation {
  const name = raw.trim()

  if (name.length < rules.minLength) {
    return {
      ok: false,
      reason: "too_short",
      message: `Usa al menos ${rules.minLength} caracteres.`,
    }
  }
  if (name.length > rules.maxLength) {
    return {
      ok: false,
      reason: "too_long",
      message: `Usa como máximo ${rules.maxLength} caracteres.`,
    }
  }

  const decision = checkName(name, rules.blockedTerms)
  if (!decision.allowed) {
    return {
      ok: false,
      reason: "blocked",
      message: "Ese nombre no está permitido. Prueba otro.",
    }
  }

  return { ok: true, name }
}
