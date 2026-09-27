import { MemoryRepository } from "@playloop/db"
import { describe, expect, it } from "vitest"

import { DEFAULT_SETTINGS, readSettingsForm } from "@/lib/settings"
import { readSettings, writeSettings } from "@/lib/settings.server"

function formOf(values: Record<string, string>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) form.set(key, value)
  return form
}

describe("app settings", () => {
  it("falls back to the defaults when nothing was saved", async () => {
    expect(await readSettings(new MemoryRepository())).toEqual(DEFAULT_SETTINGS)
  })

  it("keeps what the panel saved", async () => {
    const repository = new MemoryRepository()
    await writeSettings(repository, {
      rankingSize: 10,
      nameMaxLength: 16,
      startsPerMinute: 5,
    })

    expect(await readSettings(repository)).toEqual({
      rankingSize: 10,
      nameMaxLength: 16,
      startsPerMinute: 5,
    })
  })

  it("ignores a stored value that no longer fits its range", async () => {
    const repository = new MemoryRepository()
    await repository.saveSetting("rankingSize", 10_000)
    await repository.saveSetting("nameMaxLength", "24")

    const settings = await readSettings(repository)
    expect(settings.rankingSize).toBe(DEFAULT_SETTINGS.rankingSize)
    expect(settings.nameMaxLength).toBe(DEFAULT_SETTINGS.nameMaxLength)
  })

  it("reads a form that is within range", () => {
    expect(
      readSettingsForm(
        formOf({ rankingSize: "25", nameMaxLength: "12", startsPerMinute: "3" })
      )
    ).toEqual({
      ok: true,
      settings: { rankingSize: 25, nameMaxLength: 12, startsPerMinute: 3 },
    })
  })

  it("names the field that is out of range", () => {
    const result = readSettingsForm(
      formOf({ rankingSize: "0", nameMaxLength: "12", startsPerMinute: "3" })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Puestos del ranking/)
  })
})
