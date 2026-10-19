'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type StudioPageLoaderVariant =
  | 'default'
  | 'cards'
  | 'table'
  | 'split'
  | 'chat'
  | 'overview'
  | 'auth';

export interface StudioPageLoaderProps {
  /** Contextual status label shown in the compact header pill */
  label?: string;
  /** Layout shape that mirrors the target page's content structure */
  variant?: StudioPageLoaderVariant;
  /** Whether to show the page title/subtitle header skeleton block */
  showHeader?: boolean;
  /** Additional classes for the outer wrapper */
  className?: string;
}

/**
 * Unified, minimized, context-aware Suspense & hydration loader for the entire Studio.
 * Uses the project's single reusable <Skeleton /> and <Spinner /> primitives.
 */
export function StudioPageLoader({
  label = 'Syncing workspace...',
  variant = 'default',
  showHeader = true,
  className,
}: StudioPageLoaderProps) {
  if (variant === 'auth') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        className={cn(
          'w-full max-w-[420px] mx-auto px-2 sm:px-4 py-6 sm:py-10 animate-in fade-in duration-150',
          className
        )}
      >
        <div className="rounded-2xl sm:rounded-3xl bg-card/80 border border-border/80 p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/70 border border-border/70 text-2xs font-medium text-muted-foreground">
              <Spinner className="size-3 text-amber-500" />
              <span>{label}</span>
            </div>
          </div>
          <div className="space-y-2 flex flex-col items-center">
            <Skeleton className="h-7 w-36 rounded-lg" />
            <Skeleton className="h-3.5 w-56 max-w-full rounded-md" />
          </div>
          <div className="space-y-3 pt-1">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'chat') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        className={cn(
          'w-full flex-1 flex flex-col min-h-[460px] rounded-xl border border-border/70 bg-card/60 p-3.5 sm:p-4 space-y-3.5 animate-in fade-in duration-150',
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 border border-border/70 text-2xs font-medium text-muted-foreground">
            <Spinner className="size-3 text-amber-500" />
            <span>{label}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 flex-1 min-h-[380px]">
          <div className="md:col-span-4 space-y-2.5 border-r border-border/50 pr-0 md:pr-3">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
          <div className="md:col-span-8 flex flex-col justify-between space-y-3">
            <div className="space-y-2.5 pt-2">
              <Skeleton className="h-12 w-2/3 rounded-xl" />
              <Skeleton className="h-12 w-1/2 rounded-xl ml-auto" />
              <Skeleton className="h-14 w-3/5 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn('w-full space-y-5 pb-16 animate-in fade-in duration-150', className)}
    >
      {/* Compact Page Header Skeleton + Live Context Pill */}
      {showHeader ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44 sm:w-52 rounded-lg" />
            <Skeleton className="h-3.5 w-64 sm:w-80 max-w-full rounded-md" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/60 border border-border/70 text-2xs font-medium text-muted-foreground self-start sm:self-auto shrink-0">
            <Spinner className="size-3 text-amber-500" />
            <span>{label}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/60 border border-border/70 text-2xs font-medium text-muted-foreground shrink-0">
            <Spinner className="size-3 text-amber-500" />
            <span>{label}</span>
          </div>
        </div>
      )}

      {/* Contextual Minimized Content Skeletons */}
      {variant === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Skeleton className="h-32 w-full rounded-xl border border-border/50" />
            <Skeleton className="h-32 w-full rounded-xl border border-border/50" />
            <Skeleton className="h-32 w-full rounded-xl border border-border/50" />
            <Skeleton className="h-32 w-full rounded-xl border border-border/50" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl border border-border/50" />
        </div>
      )}

      {variant === 'table' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-20 w-full rounded-xl border border-border/50" />
            <Skeleton className="h-20 w-full rounded-xl border border-border/50" />
            <Skeleton className="h-20 w-full rounded-xl border border-border/50" />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 space-y-2.5">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      )}

      {variant === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-3">
            <Skeleton className="h-56 w-full rounded-xl border border-border/50" />
          </div>
          <div className="lg:col-span-5 space-y-3">
            <Skeleton className="h-44 w-full rounded-xl border border-border/50" />
          </div>
        </div>
      )}

      {variant === 'cards' && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-xl border border-border/60 bg-card/50 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-5 w-1/3 rounded-md" />
              <Skeleton className="h-3.5 w-2/3 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {variant === 'default' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-24 w-full rounded-xl border border-border/50" />
            <Skeleton className="h-24 w-full rounded-xl border border-border/50" />
            <Skeleton className="h-24 w-full rounded-xl border border-border/50" />
          </div>
          <Skeleton className="h-52 w-full rounded-xl border border-border/50" />
        </div>
      )}
    </div>
  );
}
