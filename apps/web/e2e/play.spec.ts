import { expect, test } from "@playwright/test"

import {
  correctLabelFor,
  item,
  loginAsOperator,
  publishGame,
  setPlayerName,
} from "./helpers"

const ITEMS = [
  item(1, "Alfa"),
  item(2, "Bravo"),
  item(3, "Charlie"),
  item(4, "Delta"),
]

test("a player answers rounds and ends up in the ranking", async ({ page }) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Partida e2e",
    slug: "partida-e2e",
    items: ITEMS,
  })

  await page.goto("/juego/partida-e2e")
  await setPlayerName(page, "Ana")
  await page.getByRole("button", { name: "Empezar" }).click()

  // The prompt image tells us which item is on screen, so right and wrong
  // answers are both deliberate.
  const correct = await correctLabelFor(page, ITEMS)
  await page.getByRole("button", { name: correct, exact: true }).click()
  await expect(page.getByText("Correcto", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Siguiente" }).click()

  // Keep losing until the lives run out, which is what finishes the game.
  const wrong = ITEMS.find((entry) => entry.label !== correct)!.label
  const ranking = page.getByRole("link", { name: "Ver ranking" })

  for (let round = 0; round < 6 && !(await ranking.isVisible()); round += 1) {
    await page.getByRole("button", { name: wrong, exact: true }).click()
    await expect(page.getByText("Fallaste", { exact: true })).toBeVisible()

    const next = page.getByRole("button", { name: "Siguiente" })
    if (await next.isVisible()) await next.click()
  }

  await expect(ranking).toBeVisible()
  await ranking.click()

  await expect(page).toHaveURL(/\/ranking\/partida-e2e$/)
  await expect(page.getByRole("listitem").filter({ hasText: "Ana" })).toBeVisible()
})

test("an unfinished game never reached the ranking", async ({ page }) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Ranking vacío e2e",
    slug: "ranking-vacio-e2e",
    items: ITEMS,
  })

  await page.goto("/juego/ranking-vacio-e2e")
  await setPlayerName(page, "Bea")
  await page.getByRole("button", { name: "Empezar" }).click()
  await expect(page.getByText("Puntos", { exact: true })).toBeVisible()

  await page.goto("/ranking/ranking-vacio-e2e")
  await expect(page.getByText("Todavía no hay puntuaciones.")).toBeVisible()
})

test("the expert mode offers the dictionary instead of options", async ({
  page,
}) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Modo experto e2e",
    slug: "modo-experto-e2e",
    items: ITEMS,
  })

  // Expert mode is enabled in the panel, which needs the dictionary loaded.
  await page.goto("/admin")
  await page
    .locator("li")
    .filter({ hasText: "Modo experto e2e" })
    .first()
    .getByRole("link")
    .click()
  await page.getByLabel("Modo experto").check()
  await page.getByRole("button", { name: "Guardar ajustes" }).click()
  await expect(page.getByLabel("Modo experto")).toBeChecked()

  await page.goto("/juego/modo-experto-e2e")
  await setPlayerName(page, "Ce")
  await page.getByRole("button", { name: "Experto" }).click()
  await page.getByRole("button", { name: "Empezar" }).click()

  await expect(
    page.getByLabel("Busca la respuesta en el diccionario")
  ).toBeVisible()

  const correct = await correctLabelFor(page, ITEMS)
  await page.getByRole("button", { name: correct, exact: true }).click()
  await expect(page.getByText("Correcto", { exact: true })).toBeVisible()
})
