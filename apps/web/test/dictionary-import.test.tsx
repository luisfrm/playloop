import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DictionaryImport } from "@/components/dictionary-import"

const FILE_LABEL = "Importar diccionario desde un archivo"

function pick(input: HTMLInputElement, contents: string, name: string): void {
  const file = new File([contents], name, { type: "text/csv" })
  fireEvent.change(input, { target: { files: [file] } })
}

describe("DictionaryImport", () => {
  it("hands the file contents to the form without saving anything", async () => {
    const onLoaded = vi.fn()
    render(<DictionaryImport onLoaded={onLoaded} />)

    pick(
      screen.getByLabelText(FILE_LABEL),
      "Alfa | A | 1\nBravo",
      "diccionario.csv"
    )

    await waitFor(() =>
      expect(onLoaded).toHaveBeenCalledWith("Alfa | A | 1\nBravo")
    )
  })

  it("tells the operator which file landed in the textarea", async () => {
    render(<DictionaryImport onLoaded={vi.fn()} />)

    pick(screen.getByLabelText(FILE_LABEL), "Alfa", "diccionario.csv")

    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent("diccionario.csv")
    expect(status).toHaveTextContent("Revisa y guarda")
  })
})
