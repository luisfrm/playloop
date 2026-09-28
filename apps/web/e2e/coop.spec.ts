import { expect, test } from "@playwright/test"

import {
  item,
  loginAsOperator,
  publishGame,
  setNameInline,
  setPlayerName,
} from "./helpers"

const ITEMS = [
  item(1, "Alfa"),
  item(2, "Bravo"),
  item(3, "Charlie"),
  item(4, "Delta"),
]
// Bravo and Delta are misses; Alfa and Charlie are the targets.
const FALSE = [1, 3]

/** Room codes avoid characters that are easy to confuse when read aloud. */
const ROOM_URL = /\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/

test("two players share one authoritative board in strict turns", async ({
  browser,
  page,
}) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Sala e2e",
    slug: "sala-e2e",
    items: ITEMS,
    falseIndexes: FALSE,
  })

  await page.goto("/game/sala-e2e")
  await setPlayerName(page, "Host")
  await page.getByRole("button", { name: "Jugar con amigos" }).click()

  await expect(page).toHaveURL(ROOM_URL)
  const code = new URL(page.url()).pathname.split("/").pop()!
  await expect(
    page.getByRole("heading", { name: `Sala ${code}` })
  ).toBeVisible()
  await expect(page.getByText("1 en la sala")).toBeVisible()

  // A second, independent browser: it has no cookie and no local storage in
  // common with the host.
  const guestContext = await browser.newContext()
  const guest = await guestContext.newPage()
  await guest.goto(`/room/${code}`)
  await setNameInline(guest, "Invitada")

  await expect(page.getByText("2 en la sala")).toBeVisible()
  await expect(guest.getByText("2 en la sala")).toBeVisible()

  // Only the host may start.
  await expect(
    guest.getByText("Esperando a que quien creó la sala empiece la partida.")
  ).toBeVisible()
  await expect(
    guest.getByRole("button", { name: "Empezar la partida" })
  ).toHaveCount(0)

  await page.getByRole("button", { name: "Empezar la partida" }).click()

  // Both screens show the same board: the room decides it, not the browser.
  for (const label of ["Alfa", "Bravo", "Charlie", "Delta"]) {
    await expect(page.getByRole("button", { name: label })).toBeVisible()
    await expect(guest.getByRole("button", { name: label })).toBeVisible()
  }

  // Strict turns: the guest cannot pick while the host holds the turn.
  await expect(guest.getByText("Turno de Host")).toBeVisible()
  await expect(page.getByText("Es tu turno")).toBeVisible()
  await expect(guest.getByRole("button", { name: "Alfa" })).toBeDisabled()

  // The host marks a target: it locks on both screens and the turn passes.
  await page.getByRole("button", { name: "Alfa" }).click()
  await expect(guest.getByRole("button", { name: "Alfa" })).toBeDisabled()
  await expect(guest.getByText("Es tu turno")).toBeVisible()

  // The guest misses: they lose a life and the host plays again.
  await guest.getByRole("button", { name: "Bravo" }).click()
  await expect(page.getByText("Es tu turno")).toBeVisible()

  // The last target completes the board: everyone standing shares the win.
  await page.getByRole("button", { name: "Charlie" }).click()
  await expect(page.getByText("Gana Host")).toBeVisible()
  await expect(guest.getByText("Gana Host")).toBeVisible()
  await expect(page.getByText("Acumulado de la sala")).toBeVisible()

  // A new match starts inside the same room on a fresh board. The starter
  // rotates, so the guest holds the first turn of match two.
  await page.getByRole("button", { name: "Jugar otra" }).click()
  await expect(page.getByText("Ronda", { exact: true })).toBeVisible()
  await expect(guest.getByText("Es tu turno")).toBeVisible()
  await expect(page.getByText("Turno de Invitada")).toBeVisible()
  await expect(guest.getByRole("button", { name: "Alfa" })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Alfa" })).toBeDisabled()

  await guestContext.close()
})
