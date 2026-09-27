import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@playloop/ui/lib/utils"

const inputVariants = cva(
  "w-full min-w-0 rounded-[var(--radius-md)] border bg-card text-foreground transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  {
    variants: {
      size: {
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-3.5 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

type InputProps = Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants> & {
    /** Element rendered inside the input, anchored to the right edge. */
    rightIcon?: React.ReactNode
  }

function Input({
  className,
  size = "default",
  type = "text",
  rightIcon,
  ...props
}: InputProps) {
  if (!rightIcon) {
    return (
      <input
        data-slot="input"
        type={type}
        className={cn(inputVariants({ size, className }))}
        {...props}
      />
    )
  }

  return (
    <div data-slot="input-wrapper" className="relative">
      <input
        data-slot="input"
        type={type}
        className={cn(inputVariants({ size, className }), "pr-10")}
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground [&_button]:pointer-events-auto">
        {rightIcon}
      </span>
    </div>
  )
}

export { Input, inputVariants }
