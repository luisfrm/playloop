import { expect, test } from "@playwright/test"

import { item, loginAsOperator, publishGame, submit } from "./helpers"

const ITEMS = [
  item(1, "Alfa"),
  item(2, "Bravo"),
  item(3, "Charlie"),
  item(4, "Delta"),
]

test("the play endpoint refuses what it should", async ({ page, request }) => {
  await loginAsOperator(page)
  await publishGame(page, { title: "API e2e", slug: "api-e2e", items: ITEMS })

  const missingPlayer = await request.post("/api/play", {
    data: { action: "start", slug: "api-e2e" },
  })
  expect(missingPlayer.status()).toBe(400)

  const shortName = await request.post("/api/play", {
    data: {
      action: "start",
      slug: "api-e2e",
      playerId: "p-1",
      playerName: "a",
    },
  })
  expect(shortName.status()).toBe(400)
  await expect(shortName.json()).resolves.toEqual({
    error: "Necesitas un nombre de al menos 2 caracteres.",
  })

  const unknownGame = await request.post("/api/play", {
    data: {
      action: "start",
      slug: "no-existe",
      playerId: "p-2",
      playerName: "Ana",
    },
  })
  expect(unknownGame.status()).toBe(404)

  const notAStart = await request.post("/api/play", {
    data: { action: "answer", playerId: "p-3", sessionId: "inventada" },
  })
  expect(notAStart.status()).toBe(410)

  const readOnly = await request.get("/api/play")
  expect(readOnly.status()).toBe(405)
})

test("a blocked name never starts a game", async ({ page, request }) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Moderación e2e",
    slug: "moderacion-e2e",
    items: ITEMS,
  })

  await page.goto("/admin/moderacion")
  await page.locator('textarea[name="blockedTerms"]').fill("tonto")
  await submit(page, "Guardar lista", "/admin/moderacion")

  const blocked = await request.post("/api/play", {
    data: {
      action: "start",
      slug: "moderacion-e2e",
      playerId: "p-blocked",
      playerName: "Tonto",
    },
  })
  expect(blocked.status()).toBe(400)

  const allowed = await request.post("/api/play", {
    data: {
      action: "start",
      slug: "moderacion-e2e",
      playerId: "p-allowed",
      playerName: "Respetuosa",
    },
  })
  expect(allowed.status()).toBe(200)
})

test("a session belongs to exactly one player id", async ({
  page,
  request,
}) => {
  await loginAsOperator(page)
  await publishGame(page, {
    title: "Sesión e2e",
    slug: "sesion-e2e",
    items: ITEMS,
  })

  const started = await request.post("/api/play", {
    data: {
      action: "start",
      slug: "sesion-e2e",
      playerId: "dueña",
      playerName: "Dueña",
    },
  })
  expect(started.status()).toBe(200)

  const payload = (await started.json()) as {
    view: { sessionId: string; options: { id: string }[] }
  }
  const sessionId = payload.view.sessionId
  expect(sessionId).toBeTruthy()
  expect(payload.view.options.length).toBeGreaterThan(1)

  const hijack = await request.post("/api/play", {
    data: {
      action: "answer",
      sessionId,
      answerId: payload.view.options[0]!.id,
      playerId: "otro",
      playerName: "Otro",
    },
  })
  expect(hijack.status()).toBe(403)

  const owner = await request.post("/api/play", {
    data: {
      action: "answer",
      sessionId,
      answerId: payload.view.options[0]!.id,
      playerId: "dueña",
      playerName: "Dueña",
    },
  })
  expect(owner.status()).toBe(200)
})

test("the session payload never carries the answer", async ({
  page,
  request,
}) => {
  await loginAsOperator(page)
  await publishGame(page, { title: "Fuga e2e", slug: "fuga-e2e", items: ITEMS })

  const started = await request.post("/api/play", {
    data: {
      action: "start",
      slug: "fuga-e2e",
      playerId: "p-fuga",
      playerName: "Curiosa",
    },
  })

  const raw = await started.text()
  // The id of the correct option is the answer; the browser must never see it.
  expect(raw).not.toContain("answerOptionId")
  expect(raw).not.toContain("isCorrect")
})
