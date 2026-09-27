import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { PlayerNamePopup } from "@/components/player-name-popup"

const STORAGE_KEY = "playloop.player"

function cachedName(name: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: "p1", name }))
}

describe("PlayerNamePopup", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("asks for a name when there is nothing cached", () => {
    render(<PlayerNamePopup />)

    expect(screen.getByRole("dialog")).toBeVisible()
    expect(screen.getByLabelText("Tu nombre en el ranking")).toBeVisible()
  })

  it("stays out of the way when the name is already cached", () => {
    cachedName("Ana")

    render(<PlayerNamePopup />)

    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes once the name is saved and keeps it for the next visit", () => {
    render(<PlayerNamePopup />)

    fireEvent.change(screen.getByLabelText("Tu nombre en el ranking"), {
      target: { value: "Ana" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Guardar nombre" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject(
      { name: "Ana" }
    )
  })

  it("lets the visitor postpone the question", () => {
    render(<PlayerNamePopup />)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
