import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@playloop/ui/components/card"

describe("Card", () => {
  it("composes its slots around the content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Tema de prueba</CardTitle>
          <CardDescription>Elemento 1</CardDescription>
        </CardHeader>
        <CardContent>Contenido</CardContent>
        <CardFooter>Pie</CardFooter>
      </Card>
    )

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Tema de prueba"
    )
    for (const slot of [
      "card",
      "card-header",
      "card-title",
      "card-description",
      "card-content",
      "card-footer",
    ]) {
      expect(
        document.querySelector(`[data-slot="${slot}"]`)
      ).toBeInTheDocument()
    }
  })

  it("defaults to the soft elevation", () => {
    render(<Card>uno</Card>)

    expect(document.querySelector('[data-slot="card"]')).toHaveClass(
      "shadow-[0_12px_32px_-16px_oklch(0.2_0.012_250/0.18)]"
    )
  })
})
