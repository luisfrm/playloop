import { ChevronDown } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@playloop/ui/lib/utils"

const selectVariants = cva(
  "w-full min-w-0 appearance-none rounded-[var(--radius-md)] border bg-card text-foreground transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  {
    variants: {
      size: {
        sm: "h-8 pr-9 pl-3 text-sm",
        default: "h-10 pr-10 pl-3.5 text-sm",
        lg: "h-12 pr-11 pl-4 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

type SelectProps = Omit<React.ComponentProps<"select">, "size" | "children"> &
  VariantProps<typeof selectVariants> & {
    children: React.ReactNode
  }

/**
 * Native select with a chevron aligned to the text padding. It stays a real
 * `<select>`, so mobile keeps its native option picker — only the closed box
 * and the desktop dropdown are themed (see `color-scheme` and `option` in
 * globals.css).
 */
function Select({
  className,
  size = "default",
  children,
  ...props
}: SelectProps) {
  return (
    <span data-slot="select-wrapper" className="relative block w-full">
      <select
        data-slot="select"
        className={cn(selectVariants({ size, className }))}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  )
}

export { Select, selectVariants }
