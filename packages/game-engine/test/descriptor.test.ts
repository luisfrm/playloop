import { describe, expect, it } from "vitest"
import { z } from "zod"

import { describeObject } from "../src/descriptor.js"
import {
  trueFalseContentSchema,
  trueFalseSettingsSchema,
} from "../src/play/types/true-false.js"

describe("describeObject", () => {
  it("turns the true_false content schema into a form", () => {
    const { fields, partial } = describeObject(trueFalseContentSchema)
    const byName = Object.fromEntries(
      fields.map((field) => [field.name, field])
    )

    expect(partial).toBe(false)
    expect(byName.label?.kind).toBe("string")
    // Long maxLength values are promoted to a textarea.
    expect(byName.mediaUrl?.kind).toBe("text")
    expect(byName.isCorrectPool?.kind).toBe("boolean")
    // Optional in the schema, so the form marks it as not required.
    expect(byName.description?.required).toBe(false)
  })

  it("exports the settings schema with its enum options", () => {
    const { fields } = describeObject(trueFalseSettingsSchema)
    const answerMode = fields.find((field) => field.name === "answerMode")

    expect(answerMode?.kind).toBe("enum")
    expect(answerMode?.options?.map((option) => option.value)).toEqual([
      "classic",
      "expert",
    ])
    expect(answerMode?.defaultValue).toBe("classic")
  })

  it("keeps numeric bounds from the schema", () => {
    const { fields } = describeObject(trueFalseSettingsSchema)
    const lives = fields.find((field) => field.name === "lives")

    expect(lives?.kind).toBe("number")
    expect(lives?.minimum).toBe(1)
    expect(lives?.maximum).toBe(10)
  })

  it("marks nullable numbers so the panel can offer 'sin límite'", () => {
    const { fields } = describeObject(trueFalseSettingsSchema)
    const total = fields.find((field) => field.name === "totalTimeLimitSeconds")

    expect(total?.nullable).toBe(true)
    expect(total?.required).toBe(false)
  })

  it("flattens nested objects with dotted names", () => {
    const schema = z.object({
      theme: z.object({
        colors: z.object({ primary: z.string() }),
        name: z.string(),
      }),
    })

    const names = describeObject(schema).fields.map((field) => field.name)
    expect(names).toEqual(["theme.colors.primary", "theme.name"])
  })

  it("supports arrays of strings as a list field", () => {
    const { fields } = describeObject(
      z.object({ aliases: z.array(z.string()).default([]) })
    )
    expect(fields[0]?.kind).toBe("stringList")
  })

  it("flags fields it cannot render instead of dropping them silently", () => {
    const { fields, partial } = describeObject(
      z.object({ weird: z.array(z.object({ a: z.string() })) })
    )

    expect(partial).toBe(true)
    expect(fields[0]?.kind).toBe("unsupported")
  })

  it("returns a partial descriptor for a non-object schema", () => {
    expect(describeObject(z.string()).partial).toBe(true)
  })

  it("humanises field names for labels", () => {
    const { fields } = describeObject(
      z.object({ isCorrectPool: z.boolean().default(true) })
    )
    expect(fields[0]?.label).toBe("Is Correct Pool")
  })
})
