import { Button } from "@playloop/ui/components/button"
import { Input } from "@playloop/ui/components/input"
import { useEffect, useState } from "react"

import {
  savePlayerName,
  validatePlayerName,
  type NameError,
} from "@/lib/player"

const MESSAGES: Record<NameError, string> = {
  empty: "Escribe un nombre para guardar tu puntuación.",
  too_short: "Usa al menos 2 caracteres.",
  too_long: "Usa como máximo 24 caracteres.",
}

export type PlayerNameFormProps = {
  initialName?: string
  onSaved?: (name: string) => void
}

export function PlayerNameForm({
  initialName = "",
  onSaved,
}: PlayerNameFormProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<NameError | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setName(initialName)
  }, [initialName])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = validatePlayerName(name)
    if (problem) {
      setError(problem)
      setSaved(false)
      return
    }

    const profile = savePlayerName(name.trim())
    setError(null)
    setSaved(true)
    onSaved?.(profile.name)
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <label className="text-sm font-medium" htmlFor="player-name">
        Tu nombre en el ranking
      </label>
      <Input
        id="player-name"
        name="playerName"
        value={name}
        autoComplete="nickname"
        maxLength={32}
        aria-invalid={error !== null}
        aria-describedby={error ? "player-name-error" : undefined}
        onChange={(event) => {
          setName(event.target.value)
          setError(null)
          setSaved(false)
        }}
      />
      <p
        id="player-name-error"
        role="status"
        aria-live="polite"
        className="min-h-5 text-xs text-muted-foreground data-[state=error]:text-destructive"
        data-state={error ? "error" : saved ? "success" : "idle"}
      >
        {error
          ? MESSAGES[error]
          : saved
            ? "Nombre guardado. Ya puedes jugar."
            : ""}
      </p>
      <Button type="submit" size="lg">
        Guardar nombre
      </Button>
    </form>
  )
}
