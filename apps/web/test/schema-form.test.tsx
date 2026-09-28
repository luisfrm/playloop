import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describeObject, gameTypes } from "@playloop/game-engine"
import { describe, expect, it, vi } from "vitest"

import { SchemaForm } from "@/components/schema-form"

const descriptor = describeObject(gameTypes.require("true_false").contentSchema)

type Props = ComponentProps<typeof SchemaForm>

function renderForm(overrides: Partial<Props> = {}) {
  const props: Props = {
    title: "Datos del elemento",
    descriptor,
    value: {},
    onChange: vi.fn(),
    ...overrides,
  }
  const view = render(<SchemaForm {...props} />)
  return { ...view, props }
}

describe("SchemaForm", () => {
  it("renders its submit button as part of the parent form, never as a nested form", () => {
    const { container } = renderForm({ submitLabel: "Guardar ajustes" })

    const root = container.firstElementChild
    expect(root?.tagName).toBe("DIV")

    const button = screen.getByRole("button", { name: "Guardar ajustes" })
    expect(button).toHaveAttribute("type", "submit")
    expect(container.querySelector("form")).toBeNull()
  })

  it("owns a form of its own when it handles the submission", () => {
    const onSubmit = vi.fn()
    const { container } = renderForm({ onSubmit })

    expect(container.firstElementChild?.tagName).toBe("FORM")

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("renders no submit button when the parent form brings its own", () => {
    renderForm()

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("disables the submit button while a submission is in flight", () => {
    renderForm({ submitLabel: "Guardar ajustes", busy: true })

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled()
  })

  it("renders one control per field of the game type schema", () => {
    renderForm()

    expect(screen.getByLabelText(/etiqueta/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/imagen/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/es verdadero/i)).toBeInTheDocument()
  })

  it("prefixes control ids so repeated forms keep unique labels", () => {
    const { container } = renderForm({ idPrefix: "element-2" })

    expect(container.querySelector("#element-2-label")).not.toBeNull()
    expect(screen.getByLabelText(/etiqueta/i).getAttribute("id")).toBe(
      "element-2-label"
    )
  })
})
