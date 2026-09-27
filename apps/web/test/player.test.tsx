import { PlayerNameForm } from "@/components/player-name-form"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  getPlayerSnapshot,
  hydratePlayer,
  readPlayer,
  savePlayerName,
  validatePlayerName,
} from "@/lib/player"

describe("validatePlayerName", () => {
  it("accepts a reasonable name", () => {
    expect(validatePlayerName("Ana")).toBeNull()
  })

  it("rejects an empty name", () => {
    expect(validatePlayerName("   ")).toBe("empty")
  })

  it("rejects a one-character name", () => {
    expect(validatePlayerName("a")).toBe("too_short")
  })

  it("rejects an over-long name", () => {
    expect(validatePlayerName("x".repeat(25))).toBe("too_long")
  })
})

describe("player persistence", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("writes the profile to localStorage and keeps the same id", () => {
    const first = savePlayerName("Ana")
    const second = savePlayerName("Beto")

    expect(second.id).toBe(first.id)
    expect(readPlayer()).toEqual({ id: first.id, name: "Beto" })
    expect(getPlayerSnapshot()?.name).toBe("Beto")
  })

  it("survives a fresh hydration", () => {
    savePlayerName("Ana")
    expect(readPlayer()?.name).toBe("Ana")
    expect(() => hydratePlayer()).not.toThrow()
  })

  it("ignores corrupted storage instead of throwing", () => {
    window.localStorage.setItem("playloop.player", "{not json")
    expect(readPlayer()).toBeNull()
  })
})

describe("PlayerNameForm", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("stores the name and confirms it", () => {
    render(<PlayerNameForm />)

    fireEvent.change(screen.getByLabelText(/tu nombre/i), {
      target: { value: "Ana" },
    })
    fireEvent.click(screen.getByRole("button", { name: /guardar nombre/i }))

    expect(screen.getByText(/nombre guardado/i)).toBeInTheDocument()
    expect(getPlayerSnapshot()?.name).toBe("Ana")
  })

  it("explains the problem instead of saving an invalid name", () => {
    render(<PlayerNameForm />)

    fireEvent.change(screen.getByLabelText(/tu nombre/i), {
      target: { value: "a" },
    })
    fireEvent.click(screen.getByRole("button", { name: /guardar nombre/i }))

    expect(screen.getByText(/al menos 2 caracteres/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tu nombre/i)).toHaveAttribute(
      "aria-invalid",
      "true"
    )
  })
})
