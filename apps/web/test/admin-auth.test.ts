import { describe, expect, it } from "vitest"

import {
  ADMIN_COOKIE,
  ADMIN_TTL_MS,
  adminConfigFromEnv,
  adminCookieForRequest,
  checkAdminPassword,
  clearAdminCookie,
  createAdminToken,
  isAdmin,
  readCookie,
  requireAdmin,
  serializeAdminCookie,
  verifyAdminToken,
} from "@/lib/admin-auth.server"

const devConfig = adminConfigFromEnv({})

function requestWithCookie(value: string | null, url = "http://localhost/admin") {
  const headers = new Headers()
  if (value) headers.set("Cookie", `${ADMIN_COOKIE}=${value}`)
  return new Request(url, { headers })
}

/**
 * `requireAdmin` throws a `Response`, not an `Error`, so the rejection is
 * caught as itself: `toMatchObject` cannot read a `Headers` instance, which
 * exposes `Location` through `get()` rather than as a property.
 */
async function redirectFrom(promise: Promise<void>): Promise<Response> {
  try {
    await promise
  } catch (thrown) {
    expect(thrown).toBeInstanceOf(Response)
    return thrown as Response
  }
  throw new Error("requireAdmin no lanzo ningun redirect")
}

describe("admin password", () => {
  it("accepts the configured password and rejects everything else", async () => {
    await expect(checkAdminPassword(devConfig, "playloop-dev")).resolves.toBe(
      true
    )
    await expect(checkAdminPassword(devConfig, "playloop-dev ")).resolves.toBe(
      false
    )
    await expect(checkAdminPassword(devConfig, "Playloop-dev")).resolves.toBe(
      false
    )
    await expect(checkAdminPassword(devConfig, "")).resolves.toBe(false)
  })

  it("treats blank env values as unset, so the panel always has a password", () => {
    const config = adminConfigFromEnv({
      ADMIN_PASSWORD: "   ",
      ADMIN_SESSION_SECRET: "",
    })

    expect(config.usingDevDefaults).toBe(true)
    expect(config.password).toBe("playloop-dev")
  })

  it("reports when the real secrets are in place", () => {
    const config = adminConfigFromEnv({
      ADMIN_PASSWORD: "s3creto",
      ADMIN_SESSION_SECRET: "clave",
    })

    expect(config.usingDevDefaults).toBe(false)
    expect(config.password).toBe("s3creto")
  })
})

describe("admin session token", () => {
  it("round-trips a freshly issued token", async () => {
    const token = await createAdminToken(devConfig)
    await expect(verifyAdminToken(devConfig, token)).resolves.toBe(true)
  })

  it("rejects an expired token", async () => {
    const token = await createAdminToken(devConfig, 1_000)
    await expect(
      verifyAdminToken(devConfig, token, 1_000 + ADMIN_TTL_MS + 1)
    ).resolves.toBe(false)
  })

  it("rejects a signature made with another secret", async () => {
    const token = await createAdminToken(
      adminConfigFromEnv({ ADMIN_SESSION_SECRET: "otra-clave" })
    )
    await expect(verifyAdminToken(devConfig, token)).resolves.toBe(false)
  })

  it("rejects tampering with the expiry, which is the only claim", async () => {
    const token = await createAdminToken(devConfig, 1_000)
    const [, expires, signature] = token.split(".")

    await expect(
      verifyAdminToken(devConfig, `v1.${Number(expires) + 60_000}.${signature}`)
    ).resolves.toBe(false)
  })

  it("rejects anything that is not a token", async () => {
    await expect(verifyAdminToken(devConfig, null)).resolves.toBe(false)
    await expect(verifyAdminToken(devConfig, "")).resolves.toBe(false)
    await expect(verifyAdminToken(devConfig, "v1")).resolves.toBe(false)
    await expect(verifyAdminToken(devConfig, "v2.99999999999.x")).resolves.toBe(
      false
    )
    await expect(verifyAdminToken(devConfig, "v1.no-numero.firma")).resolves.toBe(
      false
    )
  })
})

describe("cookies", () => {
  it("finds a cookie among others", () => {
    expect(readCookie("a=1; playloop_admin=tok; b=2", ADMIN_COOKIE)).toBe("tok")
    expect(readCookie("a=1", ADMIN_COOKIE)).toBeNull()
    expect(readCookie(null, ADMIN_COOKIE)).toBeNull()
  })

  it("marks the cookie HttpOnly, SameSite and Secure only over https", () => {
    const plain = adminCookieForRequest(
      "tok",
      new Request("http://localhost/admin")
    )
    const secure = adminCookieForRequest(
      "tok",
      new Request("https://playloop.example/admin")
    )

    expect(plain).toContain("HttpOnly")
    expect(plain).toContain("SameSite=Lax")
    expect(plain).not.toContain("Secure")
    expect(secure).toContain("Secure")
    expect(serializeAdminCookie("tok", true)).toContain("Secure")
    expect(clearAdminCookie()).toContain("Max-Age=0")
  })
})

describe("the panel guard", () => {
  it("lets a valid cookie through", async () => {
    const token = await createAdminToken(devConfig)
    await expect(isAdmin(undefined, requestWithCookie(token))).resolves.toBe(
      true
    )
  })

  it("sends an anonymous request to the login page", async () => {
    await expect(isAdmin(undefined, requestWithCookie(null))).resolves.toBe(
      false
    )

    const response = await redirectFrom(
      requireAdmin(new Request("http://localhost/admin/juego/1"), undefined)
    )

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe(
      "/admin/entrar?redirectTo=%2Fadmin%2Fjuego%2F1"
    )
  })

  it("does not bounce the login page onto itself", async () => {
    const response = await redirectFrom(
      requireAdmin(new Request("http://localhost/admin/entrar"), undefined)
    )

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("/admin/entrar")
  })

  it("ignores a cookie that was not signed by this deployment", async () => {
    await expect(
      isAdmin(undefined, requestWithCookie("v1.9999999999999.falsa"))
    ).resolves.toBe(false)
  })
})
