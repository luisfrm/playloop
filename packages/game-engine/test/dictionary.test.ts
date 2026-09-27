import { describe, expect, it } from "vitest"

import {
  entryLookupKeys,
  isDictionaryUsable,
  normalizeValue,
  parseDictionaryText,
} from "../src/dictionary.js"

describe("isDictionaryUsable", () => {
  it("keeps expert mode off while the dictionary is empty", () => {
    expect(isDictionaryUsable([])).toBe(false)
  })

  it("enables it as soon as one entry exists", () => {
    expect(
      isDictionaryUsable([
        { id: "d1", gameInstanceId: "i", value: "x", aliases: [] },
      ])
    ).toBe(true)
  })
})

describe("normalizeValue", () => {
  it("ignores case, accents and extra spacing", () => {
    expect(normalizeValue("  Ático   Norte ")).toBe("atico norte")
  })
})

describe("entryLookupKeys", () => {
  it("includes the value and every alias, normalised", () => {
    const keys = entryLookupKeys({
      id: "d1",
      gameInstanceId: "i",
      value: "Elemento Alfa",
      aliases: ["Alfa", "EL ALFA"],
    })
    expect(keys).toEqual(["elemento alfa", "alfa", "el alfa"])
  })
})

describe("parseDictionaryText", () => {
  it("parses one entry per line with pipe-separated aliases", () => {
    const parsed = parseDictionaryText("Elemento Uno | Uno | 1\nElemento Dos")
    expect(parsed).toEqual([
      { value: "Elemento Uno", aliases: ["Uno", "1"] },
      { value: "Elemento Dos", aliases: [] },
    ])
  })

  it("skips blank lines and comments", () => {
    const parsed = parseDictionaryText("\n# nota\nElemento Uno\n\n")
    expect(parsed).toHaveLength(1)
  })

  it("drops entries with an empty value", () => {
    expect(parseDictionaryText("| alias")).toHaveLength(0)
  })
})
