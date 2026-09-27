import { describe, expect, it } from "vitest"

import {
  checkName,
  moderationKey,
  normalizeForModeration,
  validateName,
  type NameRules,
} from "../src/moderation/name-filter.js"

const blocking: NameRules = {
  minLength: 2,
  maxLength: 24,
  blockedTerms: ["insulto"],
  fallback: "Jugador",
}

describe("normalizeForModeration", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeForModeration("JUGADÓR")).toBe("jugador")
  })

  it("turns separators into single spaces", () => {
    expect(normalizeForModeration("a.b-c_d")).toBe("a b c d")
  })
})

describe("moderationKey", () => {
  it("undoes leetspeak substitutions", () => {
    expect(moderationKey("1nsult0")).toBe("insulto")
    expect(moderationKey("M4r1a")).toBe("maria")
  })

  it("collapses separators so they cannot dodge the list", () => {
    expect(moderationKey("i n s u l t o")).toBe("insulto")
    expect(moderationKey("ins-ulto")).toBe("insulto")
  })
})

describe("checkName", () => {
  it("allows a clean name", () => {
    expect(checkName("Lucía", blocking.blockedTerms).allowed).toBe(true)
  })

  it("blocks a direct match", () => {
    const decision = checkName("insulto", blocking.blockedTerms)
    expect(decision.allowed).toBe(false)
  })

  it("blocks an obfuscated match", () => {
    expect(checkName("1NS-ult0", blocking.blockedTerms).allowed).toBe(false)
  })

  it("always allows when the block list is empty", () => {
    expect(checkName("insulto", []).allowed).toBe(true)
  })
})

describe("validateName", () => {
  it("returns the trimmed name when valid", () => {
    expect(validateName("  Ana  ", blocking)).toEqual({ ok: true, name: "Ana" })
  })

  it("rejects a too short name", () => {
    const result = validateName("a", blocking)
    expect(result).toMatchObject({ ok: false, reason: "too_short" })
  })

  it("rejects a too long name", () => {
    const result = validateName("x".repeat(30), blocking)
    expect(result).toMatchObject({ ok: false, reason: "too_long" })
  })

  it("rejects a blocked name and explains why", () => {
    const result = validateName("el insulto", blocking)
    expect(result).toMatchObject({ ok: false, reason: "blocked" })
    expect(result.ok === false && result.message.length > 0).toBe(true)
  })
})
