import { useRef, useState } from "react"

/**
 * Brings a dictionary file into the textarea the panel already knows how to
 * save: the bytes are read in the browser and the form keeps owning the parse,
 * so a file import and a hand-written list end up in exactly the same place.
 */
export function DictionaryImport(props: { onLoaded: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load(file: File): Promise<void> {
    try {
      setMessage("Leyendo…")
      props.onLoaded(await file.text())
      setMessage(`${file.name} copiado al cuadro. Revisa y guarda.`)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo leer el archivo."
      )
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-dashed p-3">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        aria-label="Importar diccionario desde un archivo"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void load(file)
        }}
        className="text-xs file:mr-3 file:rounded-[var(--radius-md)] file:border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium"
      />
      <p
        role="status"
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        {message ??
          "Mismo formato que el cuadro: una entrada por línea y alias separados por |."}
      </p>
    </div>
  )
}
