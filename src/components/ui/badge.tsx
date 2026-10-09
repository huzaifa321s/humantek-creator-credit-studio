import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border font-semibold w-fit whitespace-nowrap shrink-0 gap-1.5 transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground border-border",
        ghost:
          "border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        gold:
          "border-amber-400/40 bg-amber-400/10 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300 font-semibold",
        "gold-solid":
          "border-amber-400 bg-amber-400 text-zinc-950 font-black shadow-xs [a&]:hover:bg-amber-300",
        amber:
          "border-amber-400/40 bg-amber-400/10 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300 font-semibold",
        accent:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        success:
          "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold",
        warning:
          "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300 font-semibold",
        "warning-light":
          "border-amber-400/25 bg-amber-400/10 text-amber-800 dark:text-amber-300 font-semibold",
        info:
          "border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-300 font-semibold",
        "info-light":
          "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400 font-semibold",
        "success-light":
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold",
        purple:
          "border-purple-200/80 bg-purple-50 text-purple-800 dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-300 font-semibold",
        neutral:
          "border-border/70 bg-muted/60 text-muted-foreground font-medium",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        xs: "px-1.5 py-0 text-2xs leading-tight",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
