import { expect, test } from "@playwright/test"

/**
 * Creates the panel user. Every other spec keeps using the environment master
 * password, which stays valid on purpose, so this file can run anywhere in the
 * suite without locking anyone out.
 */
test("the first visitor creates the panel user and signs in with it", async ({
  page,
}) => {
  await page.goto("/init")
  await expect(
    page.getByRole("heading", { name: "Primer arranque" })
  ).toBeVisible()

  await page.getByLabel("Usuario").fill("operador-e2e")
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-e2e-12345")
  await page.getByLabel("Repite la contraseña").fill("clave-e2e-12345")
  await page.getByRole("button", { name: "Crear usuario" }).click()

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole("heading", { name: "Juegos" })).toBeVisible()

  // The new credentials open the panel again after a logout.
  await page.getByRole("button", { name: "Salir" }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)

  await page.getByLabel("Usuario").fill("operador-e2e")
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-e2e-12345")
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page).toHaveURL(/\/admin$/)
})

test("once the panel has a user, /init stays out of the way", async ({
  page,
}) => {
  await page.goto("/init")
  await expect(page).toHaveURL(/\/admin\/login$/)
})
