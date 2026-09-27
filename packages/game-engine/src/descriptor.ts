import { z } from "zod"

/**
 * The admin panel renders its forms from this descriptor instead of importing
 * Zod. That is what makes "add a game type" a one-file change: the new type's
 * schema becomes a form with no panel work.
 */

export type FieldOption = { value: string; label: string }

export type FieldKind =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "enum"
  | "stringList"
  | "unsupported"

export type FieldDescriptor = {
  name: string
  label: string
  kind: FieldKind
  required: boolean
  nullable: boolean
  defaultValue?: unknown
  description?: string
  options?: FieldOption[]
  minimum?: number
  maximum?: number
}

export type ObjectDescriptor = {
  fields: FieldDescriptor[]
  /** True when at least one field came back as `unsupported`. */
  partial: boolean
}

type JsonSchemaNode = {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  default?: unknown
  description?: string
  title?: string
  minimum?: number
  maximum?: number
  items?: JsonSchemaNode
  properties?: Record<string, JsonSchemaNode>
  required?: string[]
  anyOf?: JsonSchemaNode[]
  oneOf?: JsonSchemaNode[]
  format?: string
  additionalProperties?: unknown
  maxLength?: number
}

function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function typesOf(node: JsonSchemaNode): string[] {
  if (Array.isArray(node.type)) return node.type
  if (typeof node.type === "string") return [node.type]
  return []
}

function literalOptions(node: JsonSchemaNode): FieldOption[] | null {
  const values = node.enum ?? (node.const === undefined ? null : [node.const])
  if (!values || values.length === 0) return null
  if (!values.every((value) => typeof value === "string")) return null
  return (values as string[]).map((value) => ({
    value,
    label: humanize(value),
  }))
}

/** Zod 4 narrows unions of literals into `anyOf`, so read those too. */
function optionsFrom(node: JsonSchemaNode): FieldOption[] | null {
  const direct = literalOptions(node)
  if (direct) return direct

  const branches = node.anyOf ?? node.oneOf
  if (!branches) return null

  const options = branches.flatMap((branch) => literalOptions(branch) ?? [])
  return options.length === branches.length && options.length > 0
    ? options
    : null
}

function kindOf(node: JsonSchemaNode): FieldKind {
  if (optionsFrom(node)) return "enum"
  const types = typesOf(node)
  if (types.includes("boolean")) return "boolean"
  if (types.includes("integer") || types.includes("number")) return "number"
  if (types.includes("array")) {
    const items = node.items
    const itemTypes = items ? typesOf(items) : []
    const isText =
      itemTypes.includes("string") || optionsFrom(items ?? {}) !== null
    return isText ? "stringList" : "unsupported"
  }
  if (types.includes("string")) return "string"
  return "unsupported"
}

/**
 * Zod expresses `.nullable()` as `anyOf: [<shape>, {type:"null"}]`. Collapse that
 * back into one shape plus a `nullable` flag so the panel can render a single
 * control with an explicit "sin límite" option.
 */
function unwrapNullable(node: JsonSchemaNode): {
  node: JsonSchemaNode
  nullable: boolean
} {
  const types = typesOf(node)
  if (types.length > 0) return { node, nullable: types.includes("null") }

  const branches = node.anyOf ?? node.oneOf
  if (!branches) return { node, nullable: false }

  const nullable = branches.some((branch) => typesOf(branch).includes("null"))
  const concrete = branches.filter(
    (branch) => !typesOf(branch).includes("null")
  )
  if (nullable && concrete.length === 1) {
    return {
      node: {
        ...concrete[0],
        title: node.title,
        description: node.description,
        default: node.default,
      },
      nullable: true,
    }
  }
  return { node, nullable }
}

function describeField(
  name: string,
  rawNode: JsonSchemaNode,
  required: boolean
): FieldDescriptor {
  const options = optionsFrom(rawNode)
  const nullable = options
    ? typesOf(rawNode).includes("null")
    : unwrapNullable(rawNode).nullable
  const node = options ? rawNode : unwrapNullable(rawNode).node
  const kind: FieldKind = options ? "enum" : kindOf(node)

  const base: FieldDescriptor = {
    name,
    label: node.title ?? humanize(name),
    kind,
    required: required && !nullable,
    nullable,
    defaultValue: node.default,
    description: node.description,
  }

  if (kind === "enum" && options) base.options = options

  if (typeof node.minimum === "number") base.minimum = node.minimum
  if (typeof node.maximum === "number") base.maximum = node.maximum
  if (
    kind === "string" &&
    typeof node.maxLength === "number" &&
    node.maxLength > 200
  ) {
    base.kind = "text"
  }

  return base
}

/**
 * Turn a Zod object schema into a flat field list. Nested objects and arrays of
 * objects are flattened with dotted names so the form stays a single page.
 */
export function describeObject(schema: z.ZodType): ObjectDescriptor {
  let json: JsonSchemaNode
  try {
    json = z.toJSONSchema(schema as z.ZodType, {
      io: "input",
      unrepresentable: "any",
      override: ({ jsonSchema }) => {
        if (jsonSchema.type === "object") jsonSchema.additionalProperties = true
      },
    }) as JsonSchemaNode
  } catch {
    return { fields: [], partial: true }
  }

  const fields = flatten("", json, new Set(json.required ?? []), 0)
  return {
    fields,
    partial:
      fields.length === 0 ||
      fields.some((field) => field.kind === "unsupported"),
  }
}

function flatten(
  prefix: string,
  node: JsonSchemaNode,
  required: Set<string>,
  depth: number
): FieldDescriptor[] {
  if (depth > 3 || !node.properties) return []

  return Object.entries(node.properties).flatMap(([name, child]) => {
    const path = prefix ? `${prefix}.${name}` : name
    const childRequired = new Set(child.required ?? [])
    const isObject = typesOf(child).includes("object")

    if (isObject) return flatten(path, child, childRequired, depth + 1)
    return [describeField(path, child, required.has(name))]
  })
}
