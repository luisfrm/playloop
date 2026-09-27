import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Select } from "@playloop/ui/components/select"

describe("Select", () => {
  it("renders a native select with its options", () => {
    render(
      <Select aria-label="Modo" defaultValue="a">
        <option value="a">Opción A</option>
        <option value="b">Opción B</option>
      </Select>
    )

    const select = screen.getByRole("combobox", { name: "Modo" })
    expect(select.tagName).toBe("SELECT")
    expect(select).toHaveValue("a")
    expect(screen.getByRole("option", { name: "Opción B" })).toBeInTheDocument()
  })

  it("shows a chevron aligned with the text padding", () => {
    const { container } = render(
      <Select aria-label="Modo" defaultValue="a">
        <option value="a">Opción A</option>
      </Select>
    )

    const select = screen.getByRole("combobox", { name: "Modo" })
    expect(select).toHaveClass("appearance-none", "pr-10")
    expect(
      container.querySelector('[data-slot="select-wrapper"] svg')
    ).toBeInTheDocument()
  })

  it("reports the chosen option", () => {
    const onChange = vi.fn()
    render(
      <Select aria-label="Modo" defaultValue="a" onChange={onChange}>
        <option value="a">Opción A</option>
        <option value="b">Opción B</option>
      </Select>
    )

    fireEvent.change(screen.getByRole("combobox", { name: "Modo" }), {
      target: { value: "b" },
    })
    expect(onChange).toHaveBeenCalledOnce()
  })
})
