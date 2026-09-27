import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PasswordInput } from "@/components/password-input"

describe("PasswordInput", () => {
  it("hides the value until the eye toggle is pressed", () => {
    render(<PasswordInput aria-label="Contraseña" />)

    const input = screen.getByLabelText("Contraseña")
    expect(input).toHaveAttribute("type", "password")

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }))
    expect(input).toHaveAttribute("type", "text")
    expect(
      screen.getByRole("button", { name: "Ocultar contraseña" })
    ).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }))
    expect(input).toHaveAttribute("type", "password")
  })

  it("forwards the field props to the input", () => {
    render(
      <PasswordInput
        aria-label="Contraseña"
        name="password"
        autoComplete="current-password"
        required
      />
    )

    const input = screen.getByLabelText("Contraseña")
    expect(input).toHaveAttribute("name", "password")
    expect(input).toHaveAttribute("autoComplete", "current-password")
    expect(input).toBeRequired()
  })
})
