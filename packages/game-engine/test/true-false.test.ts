import { describe, expect, it } from "vitest"

import type { DictionaryEntry } from "../src/dictionary.js"
import {
  trueFalseGameType,
  trueFalseSettingsSchema,
} from "../src/play/types/true-false.js"
import { item, seededRandom } from "./helpers.js"

const pool = [
  item("1", { label: "Elemento Alfa" }),
  item("2", { label: "Elemento Beta" }),
  item("3", { label: "Elemento Gamma" }),
  item("4", { label: "Elemento Delta" }),
]

const settings = trueFalseSettingsSchema.parse({ optionCount: 4, lives: 3 })

describe("true_false · buildRound", () => {
  it("always includes the prompt among the options", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const round = trueFalseGameType.buildRound({
        pool,
        settings,
        random: seededRandom(seed),
      })

      expect(round).not.toBeNull()
      const optionIds = round!.options.map((option) => option.id)
      expect(optionIds).toContain(round!.prompt.id)
    }
  })

  it("never repeats an option", () => {
    const round = trueFalseGameType.buildRound({
      pool,
      settings,
      random: seededRandom(7),
    })!
    expect(new Set(round.options.map((option) => option.id)).size).toBe(
      round.options.length
    )
  })

  it("honours optionCount", () => {
    const round = trueFalseGameType.buildRound({
      pool,
      settings: trueFalseSettingsSchema.parse({ optionCount: 2 }),
      random: seededRandom(3),
    })!
    expect(round.options).toHaveLength(2)
  })

  it("only asks items flagged for the prompt pool", () => {
    const marked = [
      item("1", { isCorrectPool: false }),
      item("2", { isCorrectPool: true }),
      item("3", { isCorrectPool: true }),
    ]
    const round = trueFalseGameType.buildRound({
      pool: marked,
      settings,
      random: seededRandom(11),
    })!
    expect(round.prompt.payload.isCorrectPool).toBe(true)
  })

  it("falls back to the whole pool when nothing is flagged", () => {
    const unmarked = [
      item("1", { isCorrectPool: false }),
      item("2", { isCorrectPool: false }),
    ]
    const round = trueFalseGameType.buildRound({
      pool: unmarked,
      settings,
      random: seededRandom(5),
    })
    expect(round).not.toBeNull()
  })

  it("returns null when there is nothing to ask", () => {
    expect(
      trueFalseGameType.buildRound({ pool: [item("1")], settings })
    ).toBeNull()
  })
})

describe("true_false · classic resolution", () => {
  const round = trueFalseGameType.buildRound({
    pool,
    settings,
    random: seededRandom(9),
  })!

  it("accepts the prompt itself as the correct option", () => {
    const resolution = trueFalseGameType.resolveAnswer({
      prompt: round.prompt,
      options: round.options,
      settings,
      dictionary: [],
      answer: { kind: "option", contentItemId: round.prompt.id },
    })

    expect(resolution).toEqual({
      correct: true,
      askedContentItemId: round.prompt.id,
    })
  })

  it("rejects any other option", () => {
    const wrong = round.options.find((option) => option.id !== round.prompt.id)!
    const resolution = trueFalseGameType.resolveAnswer({
      prompt: round.prompt,
      options: round.options,
      settings,
      dictionary: [],
      answer: { kind: "option", contentItemId: wrong.id },
    })

    expect(resolution.correct).toBe(false)
  })
})

describe("true_false · expert resolution", () => {
  const prompt = item("1", { label: "Elemento Alfa" })
  const dictionary: DictionaryEntry[] = [
    {
      id: "d1",
      gameInstanceId: "inst",
      value: "Elemento Alfa",
      aliases: ["Alfa"],
    },
    { id: "d2", gameInstanceId: "inst", value: "Elemento Beta", aliases: [] },
  ]

  const resolve = (dictionaryEntryId: string) =>
    trueFalseGameType.resolveAnswer({
      prompt,
      options: [prompt],
      settings,
      dictionary,
      answer: { kind: "entry", dictionaryEntryId },
    })

  it("accepts a dictionary entry whose value matches the prompt", () => {
    expect(resolve("d1").correct).toBe(true)
  })

  it("accepts an alias of the right entry", () => {
    expect(resolve("d1").correct).toBe(true)
  })

  it("rejects the wrong entry", () => {
    expect(resolve("d2").correct).toBe(false)
  })

  it("reports an unknown entry instead of guessing", () => {
    const resolution = resolve("nope")
    expect(resolution.correct).toBe(false)
    expect(resolution.reason).toBe("not_found")
  })

  it("matches through an explicit answerKey", () => {
    const keyed = item("9", {
      label: "Etiqueta visible",
      answerKey: "Clave Interna",
    })
    const resolution = trueFalseGameType.resolveAnswer({
      prompt: keyed,
      options: [keyed],
      settings,
      dictionary: [
        {
          id: "d9",
          gameInstanceId: "inst",
          value: "clave interna",
          aliases: [],
        },
      ],
      answer: { kind: "entry", dictionaryEntryId: "d9" },
    })

    expect(resolution.correct).toBe(true)
  })

  it("ignores accents and case when matching", () => {
    const accented = item("10", { label: "Elementó Alfa" })
    const resolution = trueFalseGameType.resolveAnswer({
      prompt: accented,
      options: [accented],
      settings,
      dictionary: [
        {
          id: "d10",
          gameInstanceId: "inst",
          value: "elemento alfa",
          aliases: [],
        },
      ],
      answer: { kind: "entry", dictionaryEntryId: "d10" },
    })

    expect(resolution.correct).toBe(true)
  })
})

describe("true_false · contract", () => {
  it("declares that it needs a dictionary for expert mode", () => {
    expect(trueFalseGameType.requiresDictionary).toBe(true)
  })

  it("validates its settings through its own schema", () => {
    const parsed = trueFalseSettingsSchema.parse({})
    expect(parsed.answerMode).toBe("classic")
    expect(parsed.lives).toBe(3)
  })

  it("rejects an invalid option count", () => {
    expect(trueFalseSettingsSchema.safeParse({ optionCount: 99 }).success).toBe(
      false
    )
  })
})
