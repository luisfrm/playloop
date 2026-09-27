import { data } from "react-router"

import { guardApiAdmin } from "@/lib/admin-auth.server"
import { createUploadTicket, r2ConfigFromEnv } from "@/lib/r2-presign.server"
import { getEnv } from "@/lib/repository.server"

import type { Route } from "./+types/api-upload-url"

type Body = {
  instanceId?: string
  filename?: string
  contentType?: string
}

/**
 * Step 1 of the upload flow: the panel asks the Worker for a short-lived URL.
 * Step 2 uploads the binary straight to R2. Step 3 saves the returned object
 * reference on the content item.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 })
  }

  // Presigning is an operator-only action: it hands out a write URL to the bucket.
  const denied = await guardApiAdmin(request, context)
  if (denied) return denied

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return data({ error: "Cuerpo inválido." }, { status: 400 })
  }

  if (!body.instanceId || !body.filename) {
    return data({ error: "Faltan instanceId o filename." }, { status: 400 })
  }

  const env = getEnv(context)
  const config = r2ConfigFromEnv({
    R2_S3_ENDPOINT: env.R2_S3_ENDPOINT,
    R2_BUCKET: env.R2_BUCKET,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    MEDIA_PUBLIC_BASE_URL: env.MEDIA_PUBLIC_BASE_URL,
  })

  try {
    const ticket = await createUploadTicket(config, {
      instanceId: body.instanceId,
      filename: body.filename,
      contentType: body.contentType,
    })
    return data({
      ok: true,
      ticket: {
        ...ticket,
        // What the panel must store on the content item. A configured public
        // base URL wins; otherwise the Worker serves the object itself.
        mediaUrl: ticket.publicUrl ?? `/archivos/${ticket.objectKey}`,
      },
    })
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Las subidas a R2 no están configuradas en este entorno.",
      },
      { status: 501 }
    )
  }
}

export function loader() {
  return data({ error: "Usa POST." }, { status: 405 })
}
