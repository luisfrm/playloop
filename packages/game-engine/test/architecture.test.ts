import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { gameTypes } from "../src/index.js"

const srcDir = fileURLToPath(new URL("../src", import.meta.url))

/**
 * Subject-matter vocabulary that must never reach the engine, the panel or the
 * data model. The first real theme is loaded as data, later, through the panel.
 */
const FORBIDDEN = [
  "futbol",
  "fútbol",
  "football",
  "soccer",
  "estadio",
  "stadium",
  "kpop",
  "k-pop",
  "balón",
  "balon",
  "pelota",
  "equipo",
  "liga",
  "premier",
  "cantante",
  "cancion",
  "canción",
  "artista",
]

const FORBIDDEN_PATTERN = new RegExp(`\\b(${FORBIDDEN.join("|")})\\b`, "i")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith(".ts") ? [path] : []
  })
}

describe("domain-agnostic engine", () => {
  it("has source files to scan", () => {
    expect(sourceFiles(srcDir).length).toBeGreaterThanOrEqual(9)
  })

  it("names no content domain anywhere in the engine sources", () => {
    const offenders = sourceFiles(srcDir).flatMap((file) => {
      const text = readFileSync(file, "utf8")
      const match = text.match(FORBIDDEN_PATTERN)
      return match ? [`${file.split(/[\\/]/).pop()} → "${match[0]}"`] : []
    })

    expect(offenders).toEqual([])
  })

  it("keeps the engine free of React and HTTP concerns", () => {
    const text = sourceFiles(srcDir)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")

    expect(text).not.toMatch(/from "react"/)
    expect(text).not.toMatch(/\bnew Response\(|\bRequest\b/)
  })
})

describe("engine surface", () => {
  it("exposes a JSON-serialisable catalogue for loaders and the panel", () => {
    const payload = JSON.stringify(gameTypes.list())
    expect(payload).toContain("true_false")
    expect(JSON.parse(payload)).toHaveLength(gameTypes.list().length)
  })
})
