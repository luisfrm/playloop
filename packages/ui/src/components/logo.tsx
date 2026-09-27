import { cva, type VariantProps } from "class-variance-authority"
import { Trophy } from "lucide-react"

import { cn } from "@playloop/ui/lib/utils"

const logoVariants = cva(
  "inline-flex items-center gap-2 font-heading leading-none font-bold tracking-tight",
  {
    variants: {
      size: {
        sm: "text-lg",
        md: "text-xl",
        lg: "text-2xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

const logoMarkVariants = cva("text-primary", {
  variants: {
    size: {
      sm: "size-5",
      md: "size-6",
      lg: "size-7",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

type LogoProps = Omit<React.ComponentProps<"h1">, "title"> &
  VariantProps<typeof logoVariants> & {
    /** Texto visible de la marca. */
    title?: string
    /**
     * `h1` by default so the mark can own the page heading. Chrome that repeats
     * on every page should pass `p` and let the page own the single `h1`.
     */
    as?: "h1" | "p" | "span"
  }

function Logo({
  title = "Playloop",
  size = "md",
  className,
  as = "h1",
  ...props
}: LogoProps) {
  const Tag = as as React.ElementType

  return (
    <Tag
      data-slot="logo"
      className={cn(logoVariants({ size, className }))}
      {...props}
    >
      <Trophy
        data-slot="logo-mark"
        className={cn(logoMarkVariants({ size }))}
        aria-hidden="true"
      />
      {title}
    </Tag>
  )
}

export { Logo, logoVariants }
