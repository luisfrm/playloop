import { Button } from "@playloop/ui/components/button"
import type { ObjectDescriptor } from "@playloop/game-engine"
import { useId } from "react"

import { FieldInput } from "@/components/field-input"

export type SchemaFormProps = {
  title: string
  description?: string
  descriptor: ObjectDescriptor
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  onSubmit?: () => void
  submitLabel?: string
  busy?: boolean
  error?: string | null
  /** Prefix for control ids. Repeated forms pass their own (see FieldInput). */
  idPrefix?: string
}

function setPath(
  source: Record<string, unknown>,
  path: string,
  next: unknown
): Record<string, unknown> {
  const [head, ...rest] = path.split(".")
  if (!head) return source
  if (rest.length === 0) return { ...source, [head]: next }

  const child = (source[head] ?? {}) as Record<string, unknown>
  return { ...source, [head]: setPath(child, rest.join("."), next) }
}

/**
 * A form built entirely from a game type's schema. Adding a game type means
 * writing its schema — this component and the panel never change.
 *
 * Two modes, decided by `onSubmit`: with it, this component owns the `<form>`
 * and handles the submission itself; without it, it renders a field group
 * meant to sit inside a parent form — in that case `submitLabel` becomes the
 * parent form's own submit button, because a nested `<form>` would swallow it.
 */
export function SchemaForm(props: SchemaFormProps) {
  const headingId = useId()

  const submit =
    props.onSubmit || props.submitLabel ? (
      <Button type="submit" size="lg" disabled={props.busy}>
        {props.busy ? "Guardando…" : (props.submitLabel ?? "Guardar")}
      </Button>
    ) : null

  const body = (
    <>
      <div className="border-b pb-4">
        <h2 id={headingId} className="font-heading text-xl font-bold">
          {props.title}
        </h2>
        {props.description ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {props.description}
          </p>
        ) : null}
      </div>

      {props.descriptor.partial ? (
        <p className="rounded-[var(--radius-md)] border border-dashed p-3 text-xs text-muted-foreground">
          Algunos campos no se pueden editar desde el panel.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {props.descriptor.fields.map((field) => (
          <div
            key={field.name}
            className={field.kind === "text" ? "sm:col-span-2" : undefined}
          >
            <FieldInput
              field={field}
              value={
                field.name.split(".").reduce<unknown>((acc, key) => {
                  if (acc === null || typeof acc !== "object") return undefined
                  return (acc as Record<string, unknown>)[key]
                }, props.value) ?? field.defaultValue
              }
              onChange={(next) =>
                props.onChange(setPath(props.value, field.name, next))
              }
              idPrefix={props.idPrefix}
            />
          </div>
        ))}
      </div>

      {props.error ? (
        <p role="alert" className="text-sm text-destructive">
          {props.error}
        </p>
      ) : null}

      {submit}
    </>
  )

  const className =
    "flex flex-col gap-5 rounded-[var(--radius-lg)] border bg-card p-6"

  if (!props.onSubmit) {
    return (
      <div aria-labelledby={headingId} className={className}>
        {body}
      </div>
    )
  }

  return (
    <form
      aria-labelledby={headingId}
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        props.onSubmit?.()
      }}
    >
      {body}
    </form>
  )
}
