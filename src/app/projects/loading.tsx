import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" aria-busy="true">
      {/* Title & Subtitle */}
      <div className="space-y-2 border-b border-border/60 pb-5">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* Main Project Card Skeleton matching actual card height */}
      <div className="rounded-xl border border-border/80 bg-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <Skeleton className="h-7 w-56 rounded-md" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
          <div className="space-y-2 sm:text-right flex flex-col sm:items-end">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
        </div>

        {/* Stepper Skeleton */}
        <div className="py-4 border-t border-b border-border/50">
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>

        {/* Details Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-xs" />
              <Skeleton className="h-4 w-28 rounded-sm" />
            </div>
          ))}
        </div>

        {/* Deliverables List Skeleton */}
        <div className="pt-2 space-y-2">
          <Skeleton className="h-4 w-32 rounded-xs" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
