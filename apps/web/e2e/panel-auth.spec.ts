import { expect, test } from "@playwright/test"

import { ADMIN_PASSWORD, loginAsOperator, submit } from "./helpers"

const GUARDED_PATHS = [
  "/admin",
  "/admin/nuevo",
  "/admin/moderacion",
  "/admin/juego/lo-que-sea",
]

test("every panel route turns an anonymous visitor away", async ({ page }) => {
  for (const path of GUARDED_PATHS) {
    await page.goto(path)

    await expect(page).toHaveURL(/\/admin\/entrar/)
    await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible()
    // The destination survives the detour.
    await expect(
      page.getByRole("button", { name: "Entrar" })
    ).toBeVisible()
  }
})

test("the panel sends the guarded route back after a wrong password", async ({
  page,
}) => {
  await page.goto("/admin/moderacion")
  await expect(page).toHaveURL(/redirectTo=%2Fadmin%2Fmoderacion/)

  await page.getByLabel("Contraseña").fill("no-es-la-clave")
  // The action answers 401 on purpose: that rejection is the whole test.
  await submit(page, "Entrar", "/admin/entrar", 401)

  await expect(page.getByRole("alert")).toHaveText("Contraseña incorrecta.")
  await expect(page).toHaveURL(/\/admin\/entrar/)
})

test("logging in with the right password opens the panel and keeps the cookie private", async ({
  page,
  context,
}) => {
  await page.goto("/admin/moderacion")
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD)
  await submit(page, "Entrar", "/admin/entrar")

  await expect(page).toHaveURL(/\/admin\/moderacion$/)
  await expect(
    page.getByRole("heading", { name: "Ranking y moderación" })
  ).toBeVisible()

  const cookie = (await context.cookies()).find(
    (entry) => entry.name === "playloop_admin"
  )
  expect(cookie).toBeTruthy()
  expect(cookie!.httpOnly).toBe(true)
  // Nothing in the browser can read the signature.
  expect(
    await page.evaluate(() => document.cookie.includes("playloop_admin"))
  ).toBe(false)
})

test("logging out locks the panel again", async ({ page }) => {
  await loginAsOperator(page)

  await page.getByRole("button", { name: "Salir" }).click()
  await expect(page).toHaveURL(/\/admin\/entrar$/)
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible()

  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin\/entrar/)
})

test("a forged cookie is not a way in", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "playloop_admin",
      value: "v1.9999999999999.firma-inventada",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
    },
  ])

  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin\/entrar/)
})

test("the presign endpoint refuses to hand out a write URL anonymously", async ({
  request,
}) => {
  const response = await request.post("/api/upload-url", {
    data: { instanceId: "lo-que-sea", filename: "foto.png" },
  })

  expect(response.status()).toBe(401)
  await expect(response.json()).resolves.toEqual({ error: "No autorizado." })
})
