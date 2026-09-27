import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { Input } from "@playloop/ui/components/input"

type PasswordInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "rightIcon"
>

/** Password field with an eye toggle rendered inside the input. */
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <Input
      type={visible ? "text" : "password"}
      rightIcon={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="pointer-events-auto rounded p-0.5 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      }
      {...props}
    />
  )
}
