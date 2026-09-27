import { expect, test } from "@playwright/test"

import { correctLabelFor, item, loginAsOperator, publishGame } from "./helpers"

const ITEMS = [
  item(1, "Alfa"),
  item(2, "Bravo"),
  item(3, "Charlie"),
  item(4, "Delta"),
]

test("a downloaded game is playable with the network switched off", async ({
  page,
}) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Sin conexión e2e",
    slug: "sin-conexion-e2e",
    items: ITEMS,
  })

  // Realistic entry point, and the shell the service worker falls back to.
  await page.goto("/")
  await page.goto("/game/sin-conexion-e2e")
  await page
    .getByRole("button", { name: "Descargar para jugar sin conexión" })
    .click()
  await expect(
    page.getByText(
      "Descargado. Se juega en modo práctica: no entra al ranking."
    )
  ).toBeVisible()

  await page.getByRole("link", { name: "Jugar sin conexión" }).click()
  await expect(page).toHaveURL(/\/practice\/sin-conexion-e2e$/)
  await expect(page.getByText("Práctica sin conexión")).toBeVisible()

  // Nothing below this line may touch the server.
  await page.context().setOffline(true)

  // Reloading offline proves the shell comes from the service worker and the
  // instance from IndexedDB, not from a page that was already open.
  await page.reload()
  await expect(page.getByRole("button", { name: "Empezar" })).toBeVisible()

  await page.getByRole("button", { name: "Empezar" }).click()

  const correct = await correctLabelFor(page, ITEMS)
  await page.getByRole("button", { name: correct, exact: true }).click()
  await expect(page.getByText("Correcto", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Siguiente" }).click()
  await expect(page.getByText("Puntos", { exact: true })).toBeVisible()

  await page.context().setOffline(false)
})

test("a game that was never downloaded says so instead of failing", async ({
  page,
}) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "No descargado e2e",
    slug: "no-descargado-e2e",
    items: ITEMS,
  })

  await page.goto("/practice/no-descargado-e2e")
  await expect(
    page.getByText("Este juego no está descargado en este dispositivo.")
  ).toBeVisible()
})

test("the download can be removed again", async ({ page }) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Descarga borrable e2e",
    slug: "descarga-borrable-e2e",
    items: ITEMS,
  })

  await page.goto("/game/descarga-borrable-e2e")
  await page
    .getByRole("button", { name: "Descargar para jugar sin conexión" })
    .click()
  await page.getByRole("link", { name: "Jugar sin conexión" }).click()

  await page.getByRole("button", { name: "Quitar la descarga" }).click()
  await expect(page.getByText("Descarga eliminada")).toBeVisible()
})
