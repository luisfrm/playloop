import { defineConfig, devices } from "@playwright/test"
import { fileURLToPath } from "node:url"

const PORT = Number(process.env.PLAYLOOP_E2E_PORT ?? 4321)
const BASE_URL = `http://127.0.0.1:${PORT}`

/** Kept apart from `.wrangler/state`, so a test run never eats your dev data. */
const STATE_DIR = fileURLToPath(new URL("./.e2e/state", import.meta.url))

export default defineConfig({
  testDir: "./e2e",
  // The specs share one D1 and one room namespace, and each creates its own
  // game; one worker keeps the ordering obvious and the failures readable.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      // The Chrome already on the machine, so nothing is downloaded.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    // Tests run against the built Worker — the same artifact `wrangler deploy`
    // ships — rather than the dev server.
    command: `node e2e/prepare-db.mjs && pnpm exec react-router build && pnpm exec vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { PLAYLOOP_PERSIST_TO: STATE_DIR },
  },
})
