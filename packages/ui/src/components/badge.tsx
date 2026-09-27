import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@playloop/ui/lib/utils"

const badgeVariants = cva(
  "font-label inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.08em] uppercase",
  {
    variants: {
      accent: {
        neutral: "border-border bg-secondary text-secondary-foreground",
        pear: "border-primary-deep/40 bg-primary/25 text-foreground",
        cyan: "border-accent-2/40 bg-accent-2/15 text-accent-foreground",
        coral: "border-accent-3/40 bg-accent-3/15 text-foreground",
        mint: "border-mint/40 bg-mint/15 text-foreground",
        lavender: "border-lavender/40 bg-lavender/15 text-foreground",
      },
    },
    defaultVariants: {
      accent: "neutral",
    },
  }
)

function Badge({
  className,
  accent = "neutral",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ accent, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
