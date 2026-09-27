/**
 * Presigned URLs for Cloudflare R2.
 *
 * The browser never sees the R2 keys: the Worker signs a short-lived URL, the
 * browser uploads straight to R2, and the Worker only stores the final object
 * reference. Implemented with Web Crypto so it runs unchanged in Workers and in
 * Node during tests.
 */

export type PresignInput = {
  endpoint: string
  bucket: string
  key: string
  method: "PUT" | "GET"
  accessKeyId: string
  secretAccessKey: string
  expiresInSeconds: number
  region?: string
  now?: Date
  /** Content type to bind into the signed URL, when known. */
  contentType?: string
}

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)))
}

async function hmac(
  key: ArrayBuffer | Uint8Array,
  value: string
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value))
}

function amzDate(date: Date): { long: string; short: string } {
  const long = date.toISOString().replace(/[:-]|\.\d{3}/g, "")
  return { long, short: long.slice(0, 8) }
}

function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

/** Normalise a base URL so we never end up with a doubled path separator. */
export function normaliseEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "")
}

export async function presignR2Url(input: PresignInput): Promise<string> {
  const region = input.region ?? "auto"
  const date = input.now ?? new Date()
  const { long, short } = amzDate(date)

  const endpoint = new URL(normaliseEndpoint(input.endpoint))
  const host = endpoint.host
  const canonicalUri = `/${input.bucket}/${encodeKey(input.key)}`

  const scope = `${short}/${region}/s3/aws4_request`
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${input.accessKeyId}/${scope}`,
    "X-Amz-Date": long,
    "X-Amz-Expires": String(Math.min(input.expiresInSeconds, 604800)),
    "X-Amz-SignedHeaders": "host",
  })

  const canonicalRequest = [
    input.method,
    canonicalUri,
    query.toString(),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n")

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    long,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n")

  const dateKey = await hmac(
    encoder.encode(`AWS4${input.secretAccessKey}`),
    short
  )
  const regionKey = await hmac(dateKey, region)
  const serviceKey = await hmac(regionKey, "s3")
  const signingKey = await hmac(serviceKey, "aws4_request")
  const signature = toHex(await hmac(signingKey, stringToSign))

  query.set("X-Amz-Signature", signature)
  return `${endpoint.origin}${canonicalUri}?${query.toString()}`
}

export type R2Env = {
  endpoint?: string
  bucket?: string
  accessKeyId?: string
  secretAccessKey?: string
  publicBaseUrl?: string
}

export function r2ConfigFromEnv(
  env: Record<string, string | undefined>
): R2Env {
  return {
    endpoint: env["R2_S3_ENDPOINT"],
    bucket: env["R2_BUCKET"],
    accessKeyId: env["R2_ACCESS_KEY_ID"],
    secretAccessKey: env["R2_SECRET_ACCESS_KEY"],
    publicBaseUrl: env["MEDIA_PUBLIC_BASE_URL"],
  }
}

export function isR2Configured(config: R2Env): boolean {
  return Boolean(
    config.endpoint &&
    config.bucket &&
    config.accessKeyId &&
    config.secretAccessKey
  )
}

export type UploadTicket = {
  uploadUrl: string
  objectKey: string
  publicUrl: string | null
  expiresInSeconds: number
}

/** Build the ticket the panel hands to the browser. */
export async function createUploadTicket(
  config: R2Env,
  request: { instanceId: string; filename: string; contentType?: string },
  options: { now?: Date; expiresInSeconds?: number } = {}
): Promise<UploadTicket> {
  if (!isR2Configured(config)) {
    throw new Error("R2 is not configured (R2_S3_ENDPOINT, R2_BUCKET, keys)")
  }

  const safeName = request.filename.replace(/[^A-Za-z0-9._-]/g, "-").slice(-80)
  const objectKey = `media/${request.instanceId}/${Date.now().toString(36)}-${safeName}`
  const expiresInSeconds = options.expiresInSeconds ?? 300

  const uploadUrl = await presignR2Url({
    endpoint: config.endpoint as string,
    bucket: config.bucket as string,
    key: objectKey,
    method: "PUT",
    accessKeyId: config.accessKeyId as string,
    secretAccessKey: config.secretAccessKey as string,
    expiresInSeconds,
    contentType: request.contentType,
    now: options.now,
  })

  return {
    uploadUrl,
    objectKey,
    publicUrl: config.publicBaseUrl
      ? `${normaliseEndpoint(config.publicBaseUrl)}/${objectKey}`
      : null,
    expiresInSeconds,
  }
}
