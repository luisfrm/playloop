import { expect, test } from "@playwright/test"

import {
  correctLabelFor,
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

/** Room codes avoid characters that are easy to confuse when read aloud. */
const ROOM_URL = /\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/

test("two players share one authoritative room", async ({ browser, page }) => {
  await loginAsOperator(page)
  await publishGame(page, { title: "Sala e2e", slug: "sala-e2e", items: ITEMS })

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

  // Both screens show the same prompt: the room decides it, not the browser.
  await expect(page.locator("img")).toBeVisible()
  await expect(guest.locator("img")).toBeVisible()

  const hostPrompt = await page.locator("img").first().getAttribute("src")
  const guestPrompt = await guest.locator("img").first().getAttribute("src")
  expect(hostPrompt).toBe(guestPrompt)
  expect(ITEMS.map((entry) => entry.mediaUrl)).toContain(hostPrompt)

  const correct = await correctLabelFor(page, ITEMS)

  await page.getByRole("button", { name: correct, exact: true }).click()
  await expect(page.getByText(/Respuesta enviada/)).toBeVisible()
  // The room counted one answer and is still waiting for the other player.
  await expect(page.getByText("Han respondido").locator("..")).toHaveText(
    "Han respondido1"
  )

  await guest.getByRole("button", { name: correct, exact: true }).click()

  // Everyone answered, so the room served round two by itself — on both
  // screens, because the Durable Object is what advances.
  await expect(
    page.getByText("Pregunta", { exact: true }).locator("..")
  ).toHaveText("Pregunta2")
  await expect(
    guest.getByText("Pregunta", { exact: true }).locator("..")
  ).toHaveText("Pregunta2")

  // The host's score lives on the server: the guest's screen shows it too.
  await expect(
    guest.locator("li").filter({ hasText: "Host" }).first()
  ).toContainText("Host")

  await guestContext.close()
})
