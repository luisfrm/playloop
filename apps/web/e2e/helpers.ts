import { expect, type Page } from "@playwright/test"

/** Matches the development default in `wrangler.jsonc`, which e2e runs with. */
export const ADMIN_PASSWORD = "playloop-dev" // Only e2e tests password, not for production

export type ItemSpec = {
  label: string
  /** Served by the app itself, so a spec never reaches the network. */
  mediaUrl: string
}

/** Unique per item, which also lets a spec tell which item was prompted. */
export function item(seed: number, label: string): ItemSpec {
  return { label, mediaUrl: `/icon.svg?item=${seed}` }
}

export function itemImage(item: ItemSpec): string {
  return `img[src="${item.mediaUrl}"]`
}

/**
 * Waits for the router's action round-trip rather than the click, so a spec
 * never races the form it just submitted. By default the action is expected to
 * go through; a rejection the spec asked for names its status instead.
 */
export async function submit(
  page: Page,
  buttonName: string,
  pathPrefix: string,
  expectedStatus?: number
): Promise<void> {
  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith(pathPrefix)
  )
  await page.getByRole("button", { name: buttonName }).click()

  // A rejected action still answers, so the status is what tells the two apart.
  const response = await posted
  const status = response.status()
  if (expectedStatus !== undefined) {
    expect(status, `${buttonName} answered ${status}`).toBe(expectedStatus)
    return
  }
  expect(status, `${buttonName} answered ${status}`).toBeLessThan(400)
}

export async function loginAsOperator(page: Page): Promise<void> {
  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible()

  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN_PASSWORD)
  await submit(page, "Entrar", "/admin/login")

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole("heading", { name: "Juegos" })).toBeVisible()
}

export async function setPlayerName(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /Jugador sin nombre/ }).click()
  await page.getByLabel("Tu nombre en el ranking").fill(name)
  await page.getByRole("button", { name: "Guardar nombre" }).click()
  await expect(
    page.getByRole("button", { name: new RegExp(`Jugador: ${name}`) })
  ).toBeVisible()
}

/**
 * The room page shows the name form inline while the player is anonymous, so
 * opening the nav menu would produce a second form with the same label.
 */
export async function setNameInline(page: Page, name: string): Promise<void> {
  await page.getByLabel("Tu nombre en el ranking").fill(name)
  await page.getByRole("button", { name: "Guardar nombre" }).click()
  await expect(page.getByLabel("Tu nombre en el ranking")).toHaveCount(0)
}

async function elementCard(page: Page, index: number) {
  return page
    .locator("li")
    .filter({ hasText: `Elemento ${index + 1}` })
    .first()
}

/**
 * Walks the real panel: create, fill content, flag the misses, publish. This is
 * the path that used to fail with a foreign-key error, so it doubles as the
 * regression test for it.
 */
export async function publishGame(
  page: Page,
  spec: {
    title: string
    slug: string
    items: ItemSpec[]
    /** Item indexes that are misses. New elements are targets by default. */
    falseIndexes?: number[]
    lives?: number
  }
): Promise<void> {
  await page.goto("/admin/new")
  await page.getByLabel("Título").fill(spec.title)
  await page.getByLabel("Slug").fill(spec.slug)
  await submit(page, "Crear juego", "/admin/new")

  // Only after the router has actually moved: `page.url()` still points at the
  // form we just submitted while the navigation is in flight.
  await expect(page).toHaveURL(/\/admin\/games\/[0-9a-f-]+$/)
  const instancePath = new URL(page.url()).pathname

  for (const [index, entry] of spec.items.entries()) {
    await page.getByRole("button", { name: "Añadir elemento" }).click()
    const card = await elementCard(page, index)
    await card.locator(`#element-${index}-label`).fill(entry.label)
    await card.locator(`#element-${index}-mediaUrl`).fill(entry.mediaUrl)
    if (spec.falseIndexes?.includes(index)) {
      await card.getByLabel("Es verdadero").uncheck()
    }
  }
  await submit(page, "Guardar contenido", instancePath)

  // Reloading proves the write landed, rather than trusting the client state.
  await page.reload()
  for (const [index, entry] of spec.items.entries()) {
    const card = await elementCard(page, index)
    await expect(card.locator(`#element-${index}-label`)).toHaveValue(
      entry.label
    )
    if (spec.falseIndexes?.includes(index)) {
      await expect(card.getByLabel("Es verdadero")).not.toBeChecked()
    } else {
      await expect(card.getByLabel("Es verdadero")).toBeChecked()
    }
  }

  if (spec.lives !== undefined) {
    await page.locator("#field-lives").fill(String(spec.lives))
  }
  await page.getByLabel("Publicado").check()
  await submit(page, "Guardar ajustes", instancePath)
  await page.reload()
  await expect(page.getByLabel("Publicado")).toBeChecked()
}
