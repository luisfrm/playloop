/**
 * Bindings available to the Worker. Mirrors `apps/web/wrangler.jsonc` — when a
 * binding is added there, it must be added here too. `wrangler types` can
 * generate this file once the real resource ids exist.
 */
export interface Env {
  /** D1 — relational data. */
  DB: D1Database
  /** R2 — uploaded media. */
  MEDIA: R2Bucket
  /** KV — server-only session cache. */
  CACHE: KVNamespace
  /** Durable Objects — authoritative cooperative rooms. */
  ROOMS: DurableObjectNamespace<import("./room-do").RoomDurableObject>

  /** Panel password. A secret in production. */
  ADMIN_PASSWORD?: string
  /** Signs the panel cookie. A secret in production. */
  ADMIN_SESSION_SECRET?: string

  /** Public CDN base for uploaded media, e.g. https://media.playloop.dev */
  MEDIA_PUBLIC_BASE_URL?: string
  /** S3-compatible endpoint for R2 presigning. */
  R2_S3_ENDPOINT?: string
  R2_BUCKET?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
}
