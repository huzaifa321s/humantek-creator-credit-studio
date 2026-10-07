import { StudioCardLayout } from "@/components/StudioCardLayout";

export default function Loading() {
  return (
    <StudioCardLayout mode="standalone" backLabel="Back to Studio">
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading projects"
        className="space-y-6 pb-24 sm:pb-32"
      >
        {/* Title area */}
        <div className="space-y-2 border-b border-border/60 pb-5">
          <div className="skeleton h-9 w-48" />
          <div className="skeleton h-4 w-80 max-w-full" />
        </div>

        {/* Filter & Search row */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="skeleton h-9 w-64 rounded-lg" />
          <div className="skeleton h-9 w-64 rounded-lg" />
        </div>

        {/* Main Project Card matching real card layout */}
        <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 space-y-6 shadow-xs">
          {/* Card Top: Header & Badges */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pb-5 border-b border-border/60">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="skeleton h-5 w-24 rounded-md" />
                <div className="skeleton h-5 w-28 rounded-md" />
              </div>
              <div className="skeleton h-7 w-56 rounded-md" />
              <div className="skeleton h-4 w-72 max-w-full rounded-md" />
            </div>
            <div className="space-y-2 flex flex-col sm:items-end">
              <div className="skeleton h-6 w-32 rounded-md" />
              <div className="skeleton h-6 w-28 rounded-full" />
            </div>
          </div>

          {/* Stepper Progress Section: 6 equal columns */}
          <div className="p-4 sm:p-5 rounded-lg bg-secondary/25 border border-border/40 space-y-3">
            <div className="skeleton h-3.5 w-32 rounded-xs" />
            <div className="grid grid-cols-6 gap-2 sm:gap-4 pt-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="skeleton size-8 rounded-full" />
                  <div className="skeleton h-3.5 w-16 sm:w-20 rounded-xs" />
                  <div className="skeleton h-3 w-12 sm:w-14 rounded-xs" />
                </div>
              ))}
            </div>
          </div>

          {/* 4-Column Details Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-3 w-20 rounded-xs" />
                <div className="skeleton h-4 w-28 rounded-sm" />
              </div>
            ))}
          </div>

          {/* Deliverables List Skeleton */}
          <div className="border-t border-border/60 pt-4 space-y-2.5">
            <div className="flex justify-between items-center">
              <div className="skeleton h-3 w-28 rounded-xs" />
              <div className="skeleton h-3 w-14 rounded-xs" />
            </div>
            <div className="skeleton h-20 w-full rounded-lg" />
          </div>
        </div>

        <span className="sr-only">Loading projects…</span>
      </div>
    </StudioCardLayout>
  );
}
