import { describe, expect, it } from "vitest"

import type { TrueFalseContent } from "../src/play/types/true-false.js"
import {
  trueFalseGameType,
  trueFalseSettingsSchema,
} from "../src/play/types/true-false.js"
import { item, seededRandom } from "./helpers.js"

const pool = [
  item("1", { label: "Elemento Alfa" }),
  item("2", { label: "Elemento Beta", isTrue: false }),
  item("3", { label: "Elemento Gamma" }),
  item("4", { label: "Elemento Delta", isTrue: false }),
]

const settings = trueFalseSettingsSchema.parse({ lives: 3 })

describe("true_false · buildRound", () => {
  it("serves the whole pool as a single board", () => {
    const round = trueFalseGameType.buildRound({
      pool,
      settings,
      random: seededRandom(7),
    })

    expect(round).not.toBeNull()
    expect(round!.options.map((option) => option.id).sort()).toEqual([
      "1",
      "2",
      "3",
      "4",
    ])
  })

  it("shuffles deterministically with the same seed", () => {
    const first = trueFalseGameType.buildRound({
      pool,
      settings,
      random: seededRandom(7),
    })!
    const second = trueFalseGameType.buildRound({
      pool,
      settings,
      random: seededRandom(7),
    })!

    expect(second.options.map((option) => option.id)).toEqual(
      first.options.map((option) => option.id)
    )
  })

  it("returns null when there is nothing to play with", () => {
    expect(
      trueFalseGameType.buildRound({ pool: [item("1")], settings })
    ).toBeNull()
  })

  it("returns null when nothing is marked true", () => {
    const allFalse = [
      item("1", { isTrue: false }),
      item("2", { isTrue: false }),
    ]
    expect(
      trueFalseGameType.buildRound({ pool: allFalse, settings })
    ).toBeNull()
  })

  it("returns null when everything is marked true", () => {
    const allTrue = [item("1"), item("2")]
    expect(trueFalseGameType.buildRound({ pool: allTrue, settings })).toBeNull()
  })

  it("counts legacy rows without the flag as targets", () => {
    const legacy = {
      ...item("9"),
      payload: {
        label: "Elemento 9",
        mediaUrl: "https://example.invalid/9.png",
      } as unknown as TrueFalseContent,
    }
    const round = trueFalseGameType.buildRound({
      pool: [legacy, item("2", { isTrue: false })],
      settings,
      random: seededRandom(3),
    })
    expect(round).not.toBeNull()
  })
})

describe("true_false · resolution", () => {
  const round = trueFalseGameType.buildRound({
    pool,
    settings,
    random: seededRandom(9),
  })!

  const resolve = (contentItemId: string) =>
    trueFalseGameType.resolveAnswer({
      options: round.options,
      settings,
      dictionary: [],
      answer: { kind: "option", contentItemId },
    })

  it("accepts a marked cell as correct", () => {
    const resolution = resolve("1")
    expect(resolution).toEqual({ correct: true, askedContentItemId: "1" })
  })

  it("rejects an unmarked cell", () => {
    const resolution = resolve("2")
    expect(resolution.correct).toBe(false)
    expect(resolution.askedContentItemId).toBe("2")
  })

  it("reports an id outside the board instead of guessing", () => {
    const resolution = resolve("nope")
    expect(resolution.correct).toBe(false)
    expect(resolution.askedContentItemId).toBeNull()
    expect(resolution.reason).toBe("not_found")
  })
})

describe("true_false · contract", () => {
  it("needs no dictionary", () => {
    expect(trueFalseGameType.requiresDictionary).toBe(false)
  })

  it("loses the match on timeout and pays a completion bonus", () => {
    expect(trueFalseGameType.timeoutPolicy).toBe("lose-match")
    expect(trueFalseGameType.completionBonus).toBe(2)
  })

  it("validates its settings through the base schema", () => {
    const parsed = trueFalseSettingsSchema.parse({})
    expect(parsed.lives).toBe(3)
    expect("answerMode" in parsed).toBe(false)
  })

  it("flags cells through isTrue", () => {
    const parsed = trueFalseGameType.contentSchema.parse({
      label: "Elemento 1",
      mediaUrl: "https://example.invalid/1.png",
    })
    expect(parsed.isTrue).toBe(true)
  })
})
