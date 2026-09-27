import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Input } from "@playloop/ui/components/input"

describe("Input", () => {
  it("renders a text box by default", () => {
    render(<Input aria-label="Nombre" />)

    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute(
      "type",
      "text"
    )
  })

  it("reports what the player typed", () => {
    const onChange = vi.fn()
    render(<Input aria-label="Nombre" onChange={onChange} />)

    const input = screen.getByRole("textbox", { name: "Nombre" })
    fireEvent.change(input, { target: { value: "Ana" } })

    expect(onChange).toHaveBeenCalledOnce()
    expect(input).toHaveValue("Ana")
  })

  it("carries the size variant it was given", () => {
    render(<Input aria-label="Nombre" size="lg" />)

    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveClass("h-12")
  })
})
