import { expect, test } from "@playwright/test"

import { item, loginAsOperator, publishGame, submit } from "./helpers"

const ITEMS = [
  item(1, "Alfa"),
  item(2, "Bravo"),
  item(3, "Charlie"),
  item(4, "Delta"),
]

test("an operator creates, fills and publishes a game", async ({ page }) => {
  await loginAsOperator(page)

  await publishGame(page, {
    title: "Juego de prueba e2e",
    slug: "juego-de-prueba-e2e",
    items: ITEMS,
  })

  await expect(
    page.getByRole("heading", { name: "Juego de prueba e2e" })
  ).toBeVisible()
})

test("a published game shows up in the catalogue and a draft does not", async ({
  page,
}) => {
  await loginAsOperator(page)

  await publishGame(page, {
    title: "Visible en el catálogo",
    slug: "visible-en-el-catalogo",
    items: ITEMS,
  })

  await page.goto("/")
  await expect(page.getByRole("link", { name: /Visible en el catálogo/ })).toBeVisible()

  // A second game, left as a draft.
  await page.goto("/admin/nuevo")
  await page.getByLabel("Título").fill("Todavía borrador")
  await page.getByLabel("Slug").fill("todavia-borrador")
  await page.getByRole("button", { name: "Crear juego" }).click()
  await expect(page).toHaveURL(/\/admin\/juego\/[0-9a-f-]+$/)

  await page.goto("/")
  await expect(page.getByRole("link", { name: /Todavía borrador/ })).toHaveCount(0)
  await page.goto("/juego/todavia-borrador")
  await expect(page.getByText("Ese juego no existe")).toBeVisible()
})

test("the dictionary can be loaded from a file and then saved", async ({
  page,
}) => {
  await loginAsOperator(page)

  await page.goto("/admin/nuevo")
  await page.getByLabel("Título").fill("Diccionario por archivo")
  await page.getByLabel("Slug").fill("diccionario-por-archivo")
  await page.getByRole("button", { name: "Crear juego" }).click()
  await expect(page).toHaveURL(/\/admin\/juego\/[0-9a-f-]+$/)
  const instancePath = new URL(page.url()).pathname

  await page
    .getByLabel("Importar diccionario desde un archivo")
    .setInputFiles({
      name: "diccionario.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Alfa | A\nBravo | B"),
    })

  const textarea = page.locator('textarea[name="dictionaryText"]')
  await expect(textarea).toHaveValue("Alfa | A\nBravo | B")

  // Reloading proves the entries reached D1, not just the textarea.
  await submit(page, "Guardar diccionario", instancePath)
  await page.reload()
  await expect(textarea).toHaveValue("Alfa | A\nBravo | B")
})

test("the panel lists what was created and can delete it", async ({ page }) => {
  await loginAsOperator(page)

  await page.goto("/admin/nuevo")
  await page.getByLabel("Título").fill("Se va a borrar")
  await page.getByLabel("Slug").fill("se-va-a-borrar")
  await page.getByRole("button", { name: "Crear juego" }).click()
  await expect(page).toHaveURL(/\/admin\/juego\/[0-9a-f-]+$/)

  await page.goto("/admin")
  const row = page.locator("li").filter({ hasText: "Se va a borrar" }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText("0 elementos")

  await row.getByRole("button", { name: "Eliminar" }).click()
  await expect(page.getByText("Se va a borrar")).toHaveCount(0)
})
