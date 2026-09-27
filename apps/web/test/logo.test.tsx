import { Logo } from "@playloop/ui/components/logo"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

describe("Logo", () => {
  it("renders the default brand name as a level-one heading", () => {
    render(<Logo />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Playloop" })
    ).toBeInTheDocument()
  })

  it("renders a custom title when provided", () => {
    render(<Logo title="Otra Marca" />)

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Otra Marca"
    )
  })

  it("can step out of the heading role so a page owns its single h1", () => {
    render(<Logo as="p" />)

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByText("Playloop")).toBeInTheDocument()
  })

  it("hides the decorative mark from assistive technology", () => {
    const { container } = render(<Logo />)

    expect(container.querySelector('[data-slot="logo-mark"]')).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  })
})
