import { render, screen } from "@testing-library/react"
import { createRoutesStub } from "react-router"
import { describe, expect, it } from "vitest"

import { GameList } from "@/components/game-list"
import type { CatalogueEntry } from "@/lib/catalogue"

function entry(index: number): CatalogueEntry {
  return {
    id: `i${index}`,
    slug: `juego-${index}`,
    title: `Tema de prueba ${index}`,
    description: `Descripción ${index}`,
    gameTypeKey: "true_false",
    gameTypeLabel: "Verdadero o falso",
    contentCount: index,
    expertModeEnabled: index % 2 === 0,
  }
}

function renderList(games: CatalogueEntry[]) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <GameList games={games} /> },
  ])
  return render(<Stub initialEntries={["/"]} />)
}

describe("GameList", () => {
  it("renders one card per game", () => {
    const games = [entry(1), entry(2), entry(3), entry(4)]
    renderList(games)

    expect(screen.getAllByRole("listitem")).toHaveLength(4)
  })

  it("links every card to its game", () => {
    renderList([entry(1)])

    expect(
      screen.getByRole("link", { name: /Tema de prueba 1/ })
    ).toHaveAttribute("href", "/game/juego-1")
  })

  it("marks expert-ready games so the catalogue communicates the mode", () => {
    renderList([entry(2)])

    expect(screen.getByText("Experto")).toBeInTheDocument()
  })

  it("hides the expert badge when the instance has no dictionary", () => {
    renderList([entry(1)])

    expect(screen.queryByText("Experto")).not.toBeInTheDocument()
  })

  it("shows a placeholder description instead of an empty gap", () => {
    renderList([{ ...entry(1), description: null }])

    expect(screen.getByText(/sin descripción todavía/i)).toBeInTheDocument()
  })
})
