/**
 * Prepares a throwaway local D1 for an end-to-end run.
 *
 * Runs as part of the Playwright `webServer` command, so it is guaranteed to
 * finish before the server opens the database. Wiping the directory per run is
 * what keeps specs independent: each one creates its own game, and none of them
 * can see what an earlier run left behind.
 */
import { execFileSync } from "node:child_process"
import { rmSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, "..")
const stateDir = path.resolve(appDir, ".e2e/state")

// Wrangler's own entry point rather than its shim, so this works on Windows
// without going through a shell.
const wranglerPackage = createRequire(import.meta.url).resolve(
  "wrangler/package.json"
)
const wrangler = path.join(path.dirname(wranglerPackage), "bin", "wrangler.js")

rmSync(stateDir, { recursive: true, force: true })

execFileSync(
  process.execPath,
  [
    wrangler,
    "d1",
    "execute",
    "playloop",
    "--local",
    "--persist-to",
    stateDir,
    "--file",
    "../../packages/db/migrations/0000_init.sql",
  ],
  { cwd: appDir, stdio: "inherit" }
)

console.log(`[e2e] local D1 ready at ${stateDir}`)
