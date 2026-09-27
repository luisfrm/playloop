import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Badge } from "@playloop/ui/components/badge"

describe("Badge", () => {
  it("renders its children in a span marked as a badge", () => {
    render(<Badge>Elemento 1</Badge>)

    const badge = screen.getByText("Elemento 1")
    expect(badge.tagName).toBe("SPAN")
    expect(badge).toHaveAttribute("data-slot", "badge")
  })

  it("uses the neutral accent unless another one is asked for", () => {
    const { rerender } = render(<Badge>uno</Badge>)
    expect(screen.getByText("uno")).toHaveClass("bg-secondary")

    rerender(<Badge accent="coral">uno</Badge>)
    expect(screen.getByText("uno")).toHaveClass("border-accent-3/40")
  })

  it("keeps a caller class next to the variant", () => {
    render(<Badge className="border-dashed">dos</Badge>)

    expect(screen.getByText("dos")).toHaveClass("border-dashed")
  })
})
