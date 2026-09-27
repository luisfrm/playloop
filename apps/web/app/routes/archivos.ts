import { data } from "react-router"

import { getEnv } from "@/lib/repository.server"

import type { Route } from "./+types/archivos"

/**
 * The subset of `R2Bucket` we use. Declared locally so the app program does not
 * have to pull in the Workers globals that only the Worker program needs.
 */
type R2ObjectLike = {
  body: ReadableStream
  httpEtag: string
  writeHttpMetadata(headers: Headers): void
}

type R2BucketLike = {
  get(key: string): Promise<R2ObjectLike | null>
}

/**
 * Serves uploaded media straight from the `MEDIA` binding.
 *
 * This is what makes an upload usable without a public R2 domain: the panel
 * stores `/archivos/<objectKey>` and this route streams the object. When
 * `MEDIA_PUBLIC_BASE_URL` is configured the panel stores that URL instead, so
 * this route stays a fallback rather than the hot path.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const key = (params["*"] ?? "").trim()
  if (!key) {
    throw data({ message: "Falta el archivo." }, { status: 400 })
  }

  const bucket = getEnv(context).MEDIA as R2BucketLike | undefined
  if (!bucket) {
    throw data(
      { message: "El almacenamiento de archivos no está configurado." },
      { status: 501 }
    )
  }

  const object = await bucket.get(key)
  if (!object) {
    throw data({ message: "Ese archivo no existe." }, { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("etag", object.httpEtag)
  // Every key is unique per upload, so the object can never change in place.
  headers.set("cache-control", "public, max-age=31536000, immutable")

  return new Response(object.body, { headers })
}
