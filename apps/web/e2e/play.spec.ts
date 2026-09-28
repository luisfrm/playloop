import { expect, test } from "@playwright/test"

import { item, loginAsOperator, publishGame, setPlayerName } from "./helpers"

const ITEMS = [
  item(1, "Alfa"),
  item(2, "Bravo"),
  item(3, "Charlie"),
  item(4, "Delta"),
]
// Bravo and Delta are misses; Alfa and Charlie are the targets.
const FALSE = [1, 3]

test("a player marks the whole board and lands in the ranking", async ({
  page,
}) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Partida e2e",
    slug: "partida-e2e",
    items: ITEMS,
    falseIndexes: FALSE,
  })

  await page.goto("/game/partida-e2e")
  await setPlayerName(page, "Ana")
  await page.getByRole("button", { name: "Empezar" }).click()

  await expect(page.getByText("0 de 2")).toBeVisible()

  // Every pick resolves inline: no feedback screen, the board just locks.
  await page.getByRole("button", { name: "Alfa" }).click()
  await expect(page.getByText("1 de 2")).toBeVisible()
  await expect(page.getByRole("button", { name: "Alfa" })).toBeDisabled()

  await page.getByRole("button", { name: "Charlie" }).click()

  const ranking = page.getByRole("link", { name: "Ver ranking" })
  await expect(ranking).toBeVisible()
  await ranking.click()

  await expect(page).toHaveURL(/\/ranking\/partida-e2e$/)
  await expect(
    page.getByRole("listitem").filter({ hasText: "Ana" })
  ).toBeVisible()
})

test("a miss costs a life and losing ends the run without the bonus", async ({
  page,
}) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Derrota e2e",
    slug: "derrota-e2e",
    items: ITEMS,
    falseIndexes: FALSE,
    lives: 1,
  })

  await page.goto("/game/derrota-e2e")
  await setPlayerName(page, "Bea")
  await page.getByRole("button", { name: "Empezar" }).click()

  await page.getByRole("button", { name: "Bravo" }).click()

  await expect(page.getByText("Fallaste", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Jugar otra vez" })
  ).toBeVisible()
})

test("an unfinished game never reached the ranking", async ({ page }) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Ranking vacío e2e",
    slug: "ranking-vacio-e2e",
    items: ITEMS,
    falseIndexes: FALSE,
  })

  await page.goto("/game/ranking-vacio-e2e")
  await setPlayerName(page, "Bea")
  await page.getByRole("button", { name: "Empezar" }).click()
  await expect(page.getByText("Puntos", { exact: true })).toBeVisible()

  await page.goto("/ranking/ranking-vacio-e2e")
  await expect(page.getByText("Todavía no hay puntuaciones.")).toBeVisible()
})
