import { describe, expect, it } from "vitest"

import {
  createUploadTicket,
  isR2Configured,
  normaliseEndpoint,
  presignR2Url,
  r2ConfigFromEnv,
} from "@/lib/r2-presign.server"

const base = {
  endpoint: "https://account.r2.cloudflarestorage.com",
  bucket: "media",
  key: "media/inst-1/item.png",
  method: "PUT" as const,
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "secret-example",
  expiresInSeconds: 300,
  now: new Date("2026-01-01T00:00:00.000Z"),
}

const signatureOf = (url: string) =>
  new URL(url).searchParams.get("X-Amz-Signature") ?? ""

describe("presignR2Url", () => {
  it("produces a SigV4 query-signed URL", async () => {
    const url = new URL(await presignR2Url(base))

    expect(url.origin).toBe("https://account.r2.cloudflarestorage.com")
    expect(url.pathname).toBe("/media/media/inst-1/item.png")
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256")
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host")
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260101T000000Z")
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300")
    expect(url.searchParams.get("X-Amz-Credential")).toContain("AKIAEXAMPLE")
  })

  it("emits a 64-character hex signature", async () => {
    expect(signatureOf(await presignR2Url(base))).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is deterministic for a fixed clock", async () => {
    expect(await presignR2Url(base)).toBe(await presignR2Url(base))
  })

  it("changes when the object key changes", async () => {
    const other = await presignR2Url({ ...base, key: "media/inst-1/otro.png" })
    expect(signatureOf(other)).not.toBe(signatureOf(await presignR2Url(base)))
  })

  it("changes when the method changes", async () => {
    const get = await presignR2Url({ ...base, method: "GET" })
    expect(signatureOf(get)).not.toBe(signatureOf(await presignR2Url(base)))
  })

  it("changes when the secret changes", async () => {
    const other = await presignR2Url({
      ...base,
      secretAccessKey: "otro-secreto",
    })
    expect(signatureOf(other)).not.toBe(signatureOf(await presignR2Url(base)))
  })

  it("caps the expiry at the SigV4 maximum", async () => {
    const url = new URL(
      await presignR2Url({ ...base, expiresInSeconds: 999_999 })
    )
    expect(url.searchParams.get("X-Amz-Expires")).toBe("604800")
  })

  it("encodes special characters in the key", async () => {
    const url = new URL(
      await presignR2Url({ ...base, key: "media/una carpeta/foto 1.png" })
    )
    expect(url.pathname).toBe("/media/media/una%20carpeta/foto%201.png")
  })
})

describe("normaliseEndpoint", () => {
  it("strips trailing slashes", () => {
    expect(normaliseEndpoint("https://r2.example.com///")).toBe(
      "https://r2.example.com"
    )
  })
})

describe("upload tickets", () => {
  const config = {
    endpoint: base.endpoint,
    bucket: base.bucket,
    accessKeyId: base.accessKeyId,
    secretAccessKey: base.secretAccessKey,
    publicBaseUrl: "https://cdn.example.com",
  }

  it("detects incomplete configuration", () => {
    expect(isR2Configured(config)).toBe(true)
    expect(isR2Configured({ ...config, secretAccessKey: undefined })).toBe(
      false
    )
    expect(isR2Configured(r2ConfigFromEnv({}))).toBe(false)
  })

  it("builds a ticket with a sanitised object key", async () => {
    const ticket = await createUploadTicket(
      config,
      { instanceId: "inst 1", filename: "mi foto (1).png" },
      { now: base.now }
    )

    expect(ticket.objectKey).toMatch(/^media\/inst 1\/[\w]+-mi-foto--1-.png$/)
    expect(ticket.uploadUrl).toContain("X-Amz-Signature=")
    expect(ticket.publicUrl).toBe(`https://cdn.example.com/${ticket.objectKey}`)
    expect(ticket.expiresInSeconds).toBe(300)
  })

  it("returns a null public url when no CDN base is configured", async () => {
    const ticket = await createUploadTicket(
      { ...config, publicBaseUrl: undefined },
      { instanceId: "i", filename: "a.png" }
    )
    expect(ticket.publicUrl).toBeNull()
  })

  it("refuses to sign when R2 is not configured", async () => {
    await expect(
      createUploadTicket({}, { instanceId: "i", filename: "a.png" })
    ).rejects.toThrow(/not configured/i)
  })
})
