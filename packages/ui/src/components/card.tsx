import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@playloop/ui/lib/utils"

const cardVariants = cva(
  "rounded-[var(--radius-lg)] bg-card text-card-foreground",
  {
    variants: {
      elevation: {
        flat: "border",
        soft: "border shadow-[0_12px_32px_-16px_oklch(0.2_0.012_250/0.18)]",
        lifted: "border shadow-[0_18px_44px_-20px_oklch(0.2_0.012_250/0.24)]",
      },
    },
    defaultVariants: {
      elevation: "soft",
    },
  }
)

function Card({
  className,
  elevation = "soft",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ elevation, className }))}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("font-heading text-lg font-bold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 pb-5", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 px-5 pb-5", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cardVariants,
}
