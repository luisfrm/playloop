import { expect, test } from "@playwright/test"

/**
 * `prepare-db.mjs` seeds the operator, so in the suite `/init` always finds a
 * user and steps aside. Creating the first user is covered by unit tests
 * against an empty repository instead.
 */
test("once the panel has a user, /init stays out of the way", async ({
  page,
}) => {
  await page.goto("/init")
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible()
})
