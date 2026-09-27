import { render, screen } from "@testing-library/react"
import { createRoutesStub } from "react-router"
import { describe, expect, it } from "vitest"

import { TopNav } from "@/components/top-nav"

function renderStub(Component: React.ComponentType) {
  const Stub = createRoutesStub([{ path: "/", Component }])
  return render(<Stub initialEntries={["/"]} />)
}

describe("TopNav", () => {
  it("shows the brand mark as chrome, not as the page heading", () => {
    renderStub(TopNav)

    expect(screen.getByText("Playloop")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("exposes a labelled navigation landmark", () => {
    renderStub(TopNav)

    expect(
      screen.getByRole("navigation", { name: "Principal" })
    ).toBeInTheDocument()
  })

  it("lists the three real destinations", () => {
    renderStub(TopNav)

    const links = screen.getAllByRole("link").map((link) => link.textContent)
    expect(links).toEqual(
      expect.arrayContaining(["Catálogo", "Ranking", "Panel"])
    )
  })

  it("keeps a slot for player actions on the right", () => {
    const { container } = renderStub(TopNav)

    const actions = container.querySelector('[data-slot="top-nav-actions"]')
    expect(actions).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /jugador/i })).toBeInTheDocument()
  })
})
