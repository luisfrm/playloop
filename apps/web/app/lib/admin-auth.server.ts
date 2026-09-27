import type { RouterContextProvider } from "react-router"
import { redirect } from "react-router"

import { cloudflareContext, type CloudflareEnv } from "./cloudflare-context"

/**
 * Panel authentication.
 *
 * There is one operator, so there are no accounts: a single shared password and
 * a signed cookie. The cookie carries no session id — it is an HMAC over the
 * expiry, so verifying it costs no storage read. That keeps the panel reachable
 * even when KV is unavailable, and means a restart cannot log the operator out.
 */
export const ADMIN_COOKIE = "playloop_admin"
export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000
export const LOGIN_PATH = "/admin/login"

/**
 * Development defaults, so `pnpm dev` needs no setup. They are visible in
 * `wrangler.jsonc`, which is the point: the panel warns while they are in use.
 * `wrangler secret put ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` override them.
 */
const DEV_PASSWORD = "playloop-dev"
const DEV_SECRET = "playloop-dev-secret"

export type AdminConfig = {
  password: string
  secret: string
  /** True while either value is still the development default. */
  usingDevDefaults: boolean
}

export function adminConfigFromEnv(env: CloudflareEnv): AdminConfig {
  const password = env.ADMIN_PASSWORD?.trim()
  const secret = env.ADMIN_SESSION_SECRET?.trim()

  return {
    password: password || DEV_PASSWORD,
    secret: secret || DEV_SECRET,
    usingDevDefaults: !password || !secret,
  }
}

function readEnv(context?: unknown): CloudflareEnv {
  if (!context) return {}
  return (context as Readonly<RouterContextProvider>).get(cloudflareContext).env
}

function base64url(bytes: ArrayBuffer): string {
  let binary = ""
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return base64url(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  )
}

/** Comparing the HMACs rather than the inputs keeps the comparison length-blind. */
function equalInConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

export async function checkAdminPassword(
  config: AdminConfig,
  submitted: string
): Promise<boolean> {
  const [submittedDigest, expectedDigest] = await Promise.all([
    sign(config.secret, `password:${submitted}`),
    sign(config.secret, `password:${config.password}`),
  ])
  return equalInConstantTime(submittedDigest, expectedDigest)
}

export async function createAdminToken(
  config: AdminConfig,
  now = Date.now()
): Promise<string> {
  const payload = `v1.${now + ADMIN_TTL_MS}`
  return `${payload}.${await sign(config.secret, payload)}`
}

export async function verifyAdminToken(
  config: AdminConfig,
  token: string | null,
  now = Date.now()
): Promise<boolean> {
  if (!token) return false

  const [version, expiresRaw, signature] = token.split(".")
  if (version !== "v1" || !expiresRaw || !signature) return false

  const expiresAt = Number.parseInt(expiresRaw, 10)
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false

  return equalInConstantTime(
    await sign(config.secret, `v1.${expiresAt}`),
    signature
  )
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(";")) {
    const separator = part.indexOf("=")
    if (separator === -1) continue
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim()
    }
  }
  return null
}

/**
 * `Secure` is added only for https: local dev runs on plain http, and a Secure
 * cookie would simply never be stored there.
 */
export function serializeAdminCookie(token: string, secure: boolean): string {
  const attributes = [
    `${ADMIN_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(ADMIN_TTL_MS / 1000)}`,
  ]
  if (secure) attributes.push("Secure")
  return attributes.join("; ")
}

export function clearAdminCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/** The `Set-Cookie` to send after a successful login. */
export function adminCookieForRequest(token: string, request: Request): string {
  return serializeAdminCookie(token, new URL(request.url).protocol === "https:")
}

export async function isAdmin(context: unknown, request: Request) {
  const config = adminConfigFromEnv(readEnv(context))
  const token = readCookie(request.headers.get("Cookie"), ADMIN_COOKIE)
  return verifyAdminToken(config, token)
}

/**
 * Guard for loaders and actions. Throws, so a page cannot forget to react to
 * the result — the request never reaches the route body.
 */
export async function requireAdmin(
  request: Request,
  context: unknown
): Promise<void> {
  if (await isAdmin(context, request)) return

  const url = new URL(request.url)
  const target =
    url.pathname + url.search === LOGIN_PATH
      ? LOGIN_PATH
      : `${LOGIN_PATH}?redirectTo=${encodeURIComponent(url.pathname + url.search)}`
  throw redirect(target)
}

/** Guard for API routes, which should answer with a status rather than a page. */
export async function guardApiAdmin(request: Request, context: unknown) {
  return (await isAdmin(context, request)) ? null : unauthorized()
}

export function unauthorized() {
  return Response.json({ error: "No autorizado." }, { status: 401 })
}
