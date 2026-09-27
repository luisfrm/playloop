import { createContext } from "react-router"

/**
 * Bindings handed to loaders and actions by the Worker entry.
 *
 * Mirrors `apps/web/wrangler.jsonc`. The concrete Cloudflare types (`D1Database`,
 * `R2Bucket`, …) are only available to the Worker program, so they stay opaque
 * here and are narrowed at the point of use.
 */
export type CloudflareEnv = {
  DB?: unknown
  MEDIA?: unknown
  CACHE?: unknown
  ROOMS?: unknown
  /** Panel password and cookie-signing key. Secrets in production. */
  ADMIN_PASSWORD?: string
  ADMIN_SESSION_SECRET?: string
  MEDIA_PUBLIC_BASE_URL?: string
  R2_S3_ENDPOINT?: string
  R2_BUCKET?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
}

export type CloudflareContextValue = {
  env: CloudflareEnv
  ctx?: unknown
}

/**
 * React Router v8 passes load context as a `RouterContextProvider`, so the
 * bindings travel as a typed key rather than a plain `context.cloudflare`
 * object. The empty default keeps loaders callable outside a Worker (tests and
 * plain `vite dev`), where the in-memory fallbacks take over.
 */
export const cloudflareContext = createContext<CloudflareContextValue>({
  env: {},
})
