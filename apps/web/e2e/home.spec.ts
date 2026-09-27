import { expect, test } from "@playwright/test"

test("the catalogue asks for a name once and then remembers it", async ({
  page,
}) => {
  await page.goto("/")

  const dialog = page.getByRole("dialog", { name: "¿Cómo te llamas?" })
  await expect(dialog).toBeVisible()

  await page.getByLabel("Tu nombre en el ranking").fill("Ana")
  await page.getByRole("button", { name: "Guardar nombre" }).click()
  await expect(dialog).toHaveCount(0)

  // The name lives in the browser, so it survives a reload without asking again.
  await page.reload()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Jugador: Ana/ })).toBeVisible()
})
