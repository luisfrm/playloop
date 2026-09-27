import { useRef, useState } from "react"

type UploadState = "idle" | "asking" | "uploading" | "done" | "error"

type Ticket = {
  uploadUrl: string
  mediaUrl: string
  expiresInSeconds: number
}

/**
 * Uploads one file to R2 and reports back the URL to store on the content item.
 *
 * Three steps, deliberately: the panel asks the Worker for a short-lived URL,
 * the browser PUTs the bytes straight to R2 (the Worker never proxies the
 * binary), and only the resulting reference is saved with the content.
 */
export function MediaUpload(props: {
  instanceId: string
  /** Label of the field the returned URL is written to. */
  field: string
  currentUrl: string
  /** Uploads need the R2 secrets; without them the control explains itself. */
  enabled: boolean
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>("idle")
  const [message, setMessage] = useState<string | null>(null)

  const busy = state === "asking" || state === "uploading"

  async function askForTicket(file: File): Promise<Ticket> {
    const response = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId: props.instanceId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    })
    const payload = (await response.json()) as {
      ticket?: Ticket
      error?: string
    }
    if (!response.ok || !payload.ticket) {
      throw new Error(payload.error ?? "No se pudo preparar la subida.")
    }
    return payload.ticket
  }

  async function upload(file: File): Promise<void> {
    setMessage(null)
    try {
      setState("asking")
      const ticket = await askForTicket(file)

      setState("uploading")
      const put = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!put.ok) throw new Error(`R2 rechazó el archivo (${put.status}).`)

      props.onUploaded(ticket.mediaUrl)
      setState("done")
      setMessage("Subido. Guarda el contenido para fijarlo.")
    } catch (error) {
      setState("error")
      setMessage(error instanceof Error ? error.message : "Fallo al subir.")
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-dashed p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={!props.enabled || busy}
        aria-label={`Subir archivo para ${props.field}`}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
        className="text-xs file:mr-3 file:rounded-[var(--radius-md)] file:border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium"
      />

      <p
        role="status"
        aria-live="polite"
        className="text-xs text-muted-foreground data-[state=error]:text-destructive"
        data-state={state}
      >
        {uploadStatusText({ enabled: props.enabled, state, message })}
      </p>

      {props.currentUrl ? (
        <a
          href={props.currentUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline underline-offset-2"
        >
          Ver archivo actual
        </a>
      ) : null}
    </div>
  )
}

/** Kept out of the JSX so the control stays readable. */
function uploadStatusText(input: {
  enabled: boolean
  state: UploadState
  message: string | null
}): string {
  if (!input.enabled) return "Subidas desactivadas: faltan los secretos R2_*."
  if (input.state === "asking") return "Preparando…"
  if (input.state === "uploading") return "Subiendo…"
  return input.message ?? "Sin archivo."
}
