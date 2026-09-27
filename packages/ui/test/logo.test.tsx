import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Logo } from "@playloop/ui/components/logo"

describe("Logo", () => {
  it("owns the page heading by default", () => {
    render(<Logo />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Playloop" })
    ).toBeInTheDocument()
    expect(document.querySelector('[data-slot="logo-mark"]')).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  })

  it("steps aside so a page keeps its single h1", () => {
    render(<Logo as="p" />)

    expect(screen.queryByRole("heading")).toBeNull()
    expect(screen.getByText("Playloop")).toBeInTheDocument()
  })

  it("grows with the size variant", () => {
    render(<Logo size="lg" />)

    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("text-2xl")
  })
})
