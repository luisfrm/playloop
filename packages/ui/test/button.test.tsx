import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Button } from "@playloop/ui/components/button"

describe("Button", () => {
  it("renders a button that reports its clicks", () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Empezar</Button>)

    const button = screen.getByRole("button", { name: "Empezar" })
    expect(button).toHaveAttribute("data-slot", "button")

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("carries the variant and size classes it was given", () => {
    render(
      <Button variant="outline" size="lg">
        Salir
      </Button>
    )

    const button = screen.getByRole("button", { name: "Salir" })
    expect(button).toHaveClass("bg-background")
    expect(button).toHaveClass("h-9")
  })

  it("can borrow another element through render", () => {
    render(
      <Button render={<a href="/game/tema-de-prueba" />}>
        Jugar este juego
      </Button>
    )

    expect(
      screen.getByRole("link", { name: "Jugar este juego" })
    ).toHaveAttribute("href", "/game/tema-de-prueba")
  })

  it("marks itself disabled when it cannot be used", () => {
    render(<Button disabled>Preparando</Button>)

    expect(screen.getByRole("button", { name: "Preparando" })).toBeDisabled()
  })
})
