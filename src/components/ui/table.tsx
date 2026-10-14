"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto [scrollbar-width:thin]",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b bg-muted/40", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-border/80 bg-muted/50 font-semibold text-sm [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group/table-row border-b border-border/70 transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted/70",
        className
      )}
      {...props}
    />
  )
}

interface TableCellModifiers {
  /** Pin column to the left or right edge when horizontal scrolling occurs */
  sticky?: "left" | "right"
  /** Allow cell text to wrap naturally instead of forcing a single line */
  wrap?: boolean
}

function TableHead({
  className,
  sticky,
  wrap = false,
  ...props
}: React.ComponentProps<"th"> & TableCellModifiers) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 text-left align-middle font-semibold text-foreground/80 text-sm [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        wrap ? "whitespace-normal" : "whitespace-nowrap",
        sticky === "right" &&
          "sticky right-0 z-10 bg-muted/95 backdrop-blur-xs shadow-[-6px_0_12px_-6px_rgba(0,0,0,0.08)]",
        sticky === "left" &&
          "sticky left-0 z-10 bg-muted/95 backdrop-blur-xs shadow-[6px_0_12px_-6px_rgba(0,0,0,0.08)]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  sticky,
  wrap = false,
  ...props
}: React.ComponentProps<"td"> & TableCellModifiers) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-4 align-middle text-sm text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        wrap ? "whitespace-normal" : "whitespace-nowrap",
        sticky === "right" &&
          "sticky right-0 z-10 bg-card group-hover/table-row:bg-muted/40 transition-colors shadow-[-6px_0_12px_-6px_rgba(0,0,0,0.08)]",
        sticky === "left" &&
          "sticky left-0 z-10 bg-card group-hover/table-row:bg-muted/40 transition-colors shadow-[6px_0_12px_-6px_rgba(0,0,0,0.08)]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Responsive Table + Mobile Data Card Design System Primitives               */
/* -------------------------------------------------------------------------- */

function ResponsiveTableShell({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="responsive-table-shell"
      className={cn(
        "rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs",
        className
      )}
      {...props}
    />
  )
}

function ResponsiveDesktopView({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="responsive-desktop-view"
      className={cn("hidden md:block", className)}
      {...props}
    />
  )
}

function MobileCardList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mobile-card-list"
      role="list"
      className={cn("block md:hidden divide-y divide-border/70", className)}
      {...props}
    />
  )
}

function MobileDataCard({
  className,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<"div">) {
  const isInteractive = Boolean(onClick)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e)
    if (!e.defaultPrevented && onClick && (e.key === "Enter" || e.key === " ")) {
      // Only trigger card click if the event originated on the card itself, not a nested button
      if (e.target === e.currentTarget) {
        e.preventDefault()
        onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
      }
    }
  }

  return (
    <div
      data-slot="mobile-data-card"
      role="listitem"
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
      className={cn(
        "p-3.5 sm:p-4 space-y-3 transition-colors",
        isInteractive &&
          "hover:bg-muted/30 cursor-pointer focus-visible:outline-hidden focus-visible:bg-muted/40",
        className
      )}
      {...props}
    />
  )
}

function MobileDataCardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mobile-card-header"
      className={cn(
        "flex items-center justify-between gap-2 flex-wrap",
        className
      )}
      {...props}
    />
  )
}

function MobileDataCardBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mobile-card-body"
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    />
  )
}

function MobileDataCardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mobile-card-footer"
      className={cn(
        "pt-2.5 border-t border-border/50 flex flex-col xs:flex-row xs:items-center justify-between gap-2.5",
        className
      )}
      {...props}
    />
  )
}

function MobileDataCardActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mobile-card-actions"
      className={cn(
        "flex items-center gap-2 w-full xs:w-auto shrink-0 [&>*]:flex-1 xs:[&>*]:flex-initial",
        className
      )}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  ResponsiveTableShell,
  ResponsiveDesktopView,
  MobileCardList,
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardBody,
  MobileDataCardFooter,
  MobileDataCardActions,
}

