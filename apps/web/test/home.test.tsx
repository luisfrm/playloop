import { render, screen } from "@testing-library/react"
import { createRoutesStub } from "react-router"
import { describe, expect, it } from "vitest"

import type { CatalogueEntry } from "@/lib/catalogue"
import Home from "@/routes/home"

const games: CatalogueEntry[] = [
  {
    id: "i1",
    slug: "tema-de-prueba",
    title: "Tema de prueba",
    description: "Instancia de demostración.",
    gameTypeKey: "true_false",
    gameTypeLabel: "Verdadero o falso",
    contentCount: 6,
    expertModeEnabled: true,
  },
  {
    id: "i2",
    slug: "otro-tema",
    title: "Otro tema",
    description: null,
    gameTypeKey: "true_false",
    gameTypeLabel: "Verdadero o falso",
    contentCount: 4,
    expertModeEnabled: false,
  },
]

function renderHome(loaderGames: CatalogueEntry[]) {
  const Stub = createRoutesStub([
    { path: "/", Component: Home, loader: () => ({ games: loaderGames }) },
  ])
  return render(<Stub initialEntries={["/"]} />)
}

describe("Home", () => {
  it("states the inventory in the page heading", async () => {
    renderHome(games)

    const heading = await screen.findByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent(/^2 juegos · /)
    expect(heading).toHaveTextContent(/sin registro$/)
  })

  it("renders exactly one level-one heading", async () => {
    renderHome(games)

    expect(await screen.findAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  it("renders one card per game", async () => {
    renderHome(games)

    expect(
      await screen.findByRole("link", { name: /Tema de prueba/ })
    ).toHaveAttribute("href", "/juego/tema-de-prueba")
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2)
  })

  it("shows an empty state when nothing is published", async () => {
    renderHome([])

    expect(
      await screen.findByText(/todavía no hay juegos publicados/i)
    ).toBeInTheDocument()
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      /^0 juegos · /
    )
  })

  it("puts the name question before anything else when nothing is cached", async () => {
    localStorage.clear()

    const { container } = renderHome(games)
    await screen.findByRole("heading", { level: 1 })

    const root = container.firstElementChild as HTMLElement
    expect(root.firstElementChild).toHaveAttribute(
      "data-slot",
      "player-name-popup"
    )
  })
})
