import { describe, expect, it } from "vitest"

import { gameTypes, trueFalseGameType } from "../src/index.js"
import { GameTypeRegistry } from "../src/registry.js"

describe("GameTypeRegistry", () => {
  it("registers and reads back a type", () => {
    const registry = new GameTypeRegistry()
    registry.register(trueFalseGameType)

    expect(registry.has("true_false")).toBe(true)
    expect(registry.require("true_false")).toBe(trueFalseGameType)
  })

  it("refuses a duplicate key", () => {
    const registry = new GameTypeRegistry()
    registry.register(trueFalseGameType)

    expect(() => registry.register(trueFalseGameType)).toThrow(
      /already registered/
    )
  })

  it("throws a named error for an unknown key", () => {
    expect(() => new GameTypeRegistry().require("nope")).toThrow(
      /Unknown game type/
    )
  })

  it("lists summaries sorted by label, without leaking schemas", () => {
    const registry = new GameTypeRegistry()
    registry.register(trueFalseGameType)

    const [summary] = registry.list()
    expect(summary).toEqual({
      key: "true_false",
      label: "Verdadero o falso",
      description: expect.any(String),
      requiresDictionary: false,
    })
  })
})

describe("application registry", () => {
  it("ships with the true_false type registered", () => {
    expect(gameTypes.list().map((type) => type.key)).toContain("true_false")
  })
})
