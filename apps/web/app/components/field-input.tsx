import { Input } from "@playloop/ui/components/input"
import type { FieldDescriptor } from "@playloop/game-engine"

export type FieldInputProps = {
  field: FieldDescriptor
  value: unknown
  onChange: (value: unknown) => void
}

function asText(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  return ""
}

/**
 * One control per descriptor kind. The panel never imports a game type's
 * schema — it renders whatever shape came back from `describeObject`.
 */
export function FieldInput({ field, value, onChange }: FieldInputProps) {
  const id = `field-${field.name.replace(/\./g, "-")}`
  const describedBy = field.description ? `${id}-hint` : undefined

  const label = (
    <label className="text-sm font-medium" htmlFor={id}>
      {field.label}
      {field.required ? <span className="text-destructive"> *</span> : null}
    </label>
  )

  const hint = field.description ? (
    <p id={`${id}-hint`} className="text-xs text-muted-foreground">
      {field.description}
    </p>
  ) : null

  if (field.kind === "boolean") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="checkbox"
            className="size-4 rounded border-input accent-[var(--primary)]"
            checked={value === true}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.checked)}
          />
          {label}
        </div>
        {hint}
      </div>
    )
  }

  if (field.kind === "enum") {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <select
          id={id}
          className="h-10 w-full rounded-[var(--radius-md)] border bg-card px-3.5 text-sm"
          value={asText(value)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hint}
      </div>
    )
  }

  if (field.kind === "number") {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <Input
          id={id}
          type="number"
          min={field.minimum}
          max={field.maximum}
          value={asText(value)}
          aria-describedby={describedBy}
          onChange={(event) => {
            const raw = event.target.value
            onChange(
              raw === "" ? (field.nullable ? null : undefined) : Number(raw)
            )
          }}
        />
        {hint}
      </div>
    )
  }

  if (field.kind === "stringList") {
    const list = Array.isArray(value) ? (value as unknown[]).map(String) : []
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <Input
          id={id}
          value={list.join(", ")}
          placeholder="Separa con comas"
          aria-describedby={describedBy}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
            )
          }
        />
        {hint}
      </div>
    )
  }

  if (field.kind === "text") {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <textarea
          id={id}
          rows={3}
          className="w-full rounded-[var(--radius-md)] border bg-card px-3.5 py-2 text-sm"
          value={asText(value)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
        {hint}
      </div>
    )
  }

  if (field.kind === "unsupported") {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed p-3 text-xs text-muted-foreground">
        El campo <strong>{field.name}</strong> no se puede editar desde el
        panel.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <Input
        id={id}
        value={asText(value)}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint}
    </div>
  )
}
