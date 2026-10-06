"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center p-1 text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-secondary/70 border border-border/60 gap-1 shadow-2xs",
        line: "gap-2 bg-transparent border-b border-border/80 rounded-none p-0",
        soft: "bg-secondary/40 border-0 gap-1",
      },
      size: {
        sm: "h-8 p-0.5 rounded-lg",
        default: "h-10 p-1 rounded-xl",
        lg: "h-12 p-1.5 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  size = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
    />
  )
}

const tabsTriggerVariants = cva(
  "group/tabs-trigger relative inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-all select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:text-foreground hover:bg-background/40 data-active:bg-card data-active:text-foreground data-active:shadow-2xs data-active:font-bold data-active:ring-1 data-active:ring-border/60",
        line:
          "rounded-none bg-transparent pb-3 pt-2 text-muted-foreground hover:text-foreground data-active:bg-transparent data-active:text-foreground data-active:font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-500 after:opacity-0 data-active:after:opacity-100",
        soft:
          "text-muted-foreground hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-xs data-active:font-bold",
      },
      size: {
        sm: "h-7 px-2.5 text-xs rounded-md [&_svg]:size-3.5",
        default: "h-8 px-3.5 text-sm rounded-lg [&_svg]:size-3.5",
        lg: "h-9 px-4 text-sm rounded-lg [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function TabsTrigger({
  className,
  variant = "default",
  size = "default",
  ...props
}: TabsPrimitive.Tab.Props & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      data-variant={variant}
      data-size={size}
      className={cn(tabsTriggerVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function TabsBadge({
  className,
  count,
  children,
  ...props
}: React.ComponentProps<typeof Badge> & { count?: number | string }) {
  const val = count !== undefined ? count : children;
  if (val === undefined || val === null) return null;
  return (
    <Badge
      variant="secondary"
      size="xs"
      data-slot="tabs-badge"
      className={cn(
        "tabular-nums transition-colors ml-1 border-0 text-[10.5px] font-bold px-1.5 py-0",
        "bg-muted/80 text-muted-foreground group-data-active/tabs-trigger:bg-amber-500/15 group-data-active/tabs-trigger:text-amber-800 dark:group-data-active/tabs-trigger:text-amber-300 group-data-active/tabs-trigger:ring-1 group-data-active/tabs-trigger:ring-amber-500/30",
        className
      )}
      {...props}
    >
      {val}
    </Badge>
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsBadge,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
}
