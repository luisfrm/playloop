import type { ContentRepository } from "@playloop/db"

/**
 * The operator account of the panel.
 *
 * Until `/init` runs there is no user: the panel falls back to the environment
 * password, which is also its master credential (`wrangler secret put
 * ADMIN_PASSWORD`). Creating the first user stores a PBKDF2 hash in
 * `app_setting`, so the password is never written down anywhere.
 */
export const ADMIN_USER_KEY = "admin.user"

export const USERNAME_MIN = 3
export const USERNAME_MAX = 32
export const PASSWORD_MIN = 8
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/

const ITERATIONS = 210_000
const SALT_BYTES = 16
const KEY_BITS = 256

export type AdminUser = {
  username: string
  /** `pbkdf2$sha256$<iterations>$<salt>$<hash>`, base64. */
  passwordHash: string
  createdAt: number
}

function toBase64(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    KEY_BITS
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

/** Length-blind comparison, so a wrong password reveals nothing by timing. */
function equalInConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0)
  }
  return difference === 0
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [scheme, hashName, iterationsRaw, saltRaw, hashRaw] = stored.split("$")
  if (scheme !== "pbkdf2" || hashName !== "sha256") return false
  if (!iterationsRaw || !saltRaw || !hashRaw) return false

  const iterations = Number.parseInt(iterationsRaw, 10)
  if (!Number.isInteger(iterations) || iterations <= 0) return false

  const expected = fromBase64(hashRaw)
  const actual = await derive(password, fromBase64(saltRaw), iterations)
  return equalInConstantTime(actual, expected)
}

function isAdminUser(value: unknown): value is AdminUser {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<AdminUser>
  return (
    typeof candidate.username === "string" &&
    typeof candidate.passwordHash === "string" &&
    typeof candidate.createdAt === "number"
  )
}

export async function readAdminUser(
  repository: ContentRepository
): Promise<AdminUser | null> {
  const stored = (await repository.listSettings())[ADMIN_USER_KEY]
  return isAdminUser(stored) ? stored : null
}

/**
 * Creates the very first user. Returns null when the panel already has one:
 * `/init` is a first-run door, not a way to add accounts.
 */
export async function createAdminUser(
  repository: ContentRepository,
  input: { username: string; password: string }
): Promise<AdminUser | null> {
  if (await readAdminUser(repository)) return null

  const user: AdminUser = {
    username: input.username.trim(),
    passwordHash: await hashPassword(input.password),
    createdAt: Date.now(),
  }
  await repository.saveSetting(ADMIN_USER_KEY, user)
  return user
}

export async function verifyStoredUser(
  repository: ContentRepository,
  input: { username: string; password: string }
): Promise<boolean> {
  const user = await readAdminUser(repository)
  if (!user) return false
  if (user.username.toLowerCase() !== input.username.trim().toLowerCase()) {
    return false
  }
  return verifyPassword(input.password, user.passwordHash)
}

/** Explains what is wrong with a new user, or null when it is fine. */
export function validateNewUser(input: {
  username: string
  password: string
  repeat: string
}): string | null {
  const username = input.username.trim()

  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `El usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "El usuario solo admite letras, números, punto, guion y guion bajo."
  }
  if (input.password.length < PASSWORD_MIN) {
    return `La contraseña necesita al menos ${PASSWORD_MIN} caracteres.`
  }
  if (input.password !== input.repeat) {
    return "Las dos contraseñas no coinciden."
  }
  return null
}
