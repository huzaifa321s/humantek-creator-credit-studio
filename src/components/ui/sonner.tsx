"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ position = "bottom-left", ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={position}
      duration={3600}
      visibleToasts={3}
      closeButton
      gap={8}
      offset={20}
      icons={{
        success: (
          <CircleCheckIcon className="size-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ),
        info: (
          <InfoIcon className="size-4.5 text-brand-text dark:text-amber-400 shrink-0" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4.5 text-brand-text dark:text-amber-400 shrink-0" />
        ),
        error: (
          <OctagonXIcon className="size-4.5 text-rose-600 dark:text-rose-400 shrink-0" />
        ),
        loading: (
          <Loader2Icon className="size-4.5 animate-spin text-brand-text dark:text-amber-400 shrink-0" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xs group-[.toaster]:rounded-xl font-sans text-sm border",
          title: "font-bold text-foreground text-sm tracking-tight",
          description: "text-muted-foreground text-xs leading-relaxed",
          actionButton:
            "bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors",
          cancelButton:
            "bg-muted text-muted-foreground hover:bg-accent text-xs rounded-lg px-3 py-1.5 transition-colors",
          closeButton:
            "bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
