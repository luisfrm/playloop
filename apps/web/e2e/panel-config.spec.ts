import { expect, test } from "@playwright/test"

import { loginAsOperator, submit } from "./helpers"

/**
 * The configuration section owns the runtime limits, so the spec checks the
 * round-trip through D1 rather than the client state.
 */
test("the panel stores a limit and it survives a reload", async ({ page }) => {
  await loginAsOperator(page)

  await page.goto("/admin/settings")
  await expect(
    page.getByRole("heading", { name: "Configuración" })
  ).toBeVisible()

  await page.getByLabel("Puestos del ranking").fill("3")
  await submit(page, "Guardar configuración", "/admin/settings")

  await page.reload()
  await expect(page.getByLabel("Puestos del ranking")).toHaveValue("3")

  // Back to the default, so the ranking specs that run after this one are
  // unaffected by the value left behind.
  await page.getByLabel("Puestos del ranking").fill("50")
  await submit(page, "Guardar configuración", "/admin/settings")
  await page.reload()
  await expect(page.getByLabel("Puestos del ranking")).toHaveValue("50")
})
