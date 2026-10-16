"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

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

interface TablePaginationBarProps {
  page: number
  totalPages: number
  pageSize: number
  pageSizeOptions?: number[]
  totalCount: number
  fromIndex: number
  toIndex: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  className?: string
}

function TablePaginationBar({
  page,
  totalPages,
  pageSize,
  pageSizeOptions = [5, 10, 25, 50],
  totalCount,
  fromIndex,
  toIndex,
  isLoading = false,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationBarProps) {
  const minTier = pageSizeOptions[0] ?? 5
  const maxNeededTier =
    pageSizeOptions.find((t) => t >= Math.max(totalCount, minTier)) ??
    pageSizeOptions[pageSizeOptions.length - 1] ??
    minTier
  const availablePageSizes = pageSizeOptions.filter((t) => t <= maxNeededTier)
  const effectivePageSize = Math.min(pageSize, maxNeededTier)

  return (
    <div
      data-slot="table-pagination-bar"
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-border/70 bg-card text-xs",
        className
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Rows per page:</span>
        <Select
          value={String(effectivePageSize)}
          onValueChange={(val) => {
            onPageSizeChange(Number(val))
          }}
        >
          <SelectTrigger className="h-7 w-16 text-xs bg-card rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availablePageSizes.map((size) => (
              <SelectItem key={size} value={String(size)} className="text-xs">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          Page <b className="text-foreground font-mono tabular-nums">{page}</b> of{" "}
          <b className="text-foreground font-mono tabular-nums">{totalPages}</b>
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="size-7 rounded-lg cursor-pointer"
          aria-label="Previous Page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        <span className="text-2xs px-2 font-mono font-semibold tabular-nums text-muted-foreground">
          {fromIndex}–{toIndex} of {totalCount}
        </span>

        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="size-7 rounded-lg cursor-pointer"
          aria-label="Next Page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
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
  TablePaginationBar,
}

