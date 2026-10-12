import React from 'react';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ConfirmationLoading() {
  return (
    <StudioCardLayout
      mode="wizard"
      hideStepper={true}
      showBack={false}
      topRightBadge={null}
    >
      <div className="w-full flex items-center justify-center py-6 sm:py-10 pb-24 sm:pb-14 animate-in fade-in duration-150">
        <Card className="max-w-lg w-full mx-auto rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-6 shadow-sm text-center">
          {/* Top Status Icon Skeleton */}
          <div className="size-12 rounded-full mx-auto bg-amber-400/20 ring-8 ring-amber-400/10 flex items-center justify-center animate-pulse">
            <Skeleton className="size-6 rounded-full" />
          </div>

          {/* Title & Subtitle Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 mx-auto rounded-lg" />
            <Skeleton className="h-4 w-72 max-w-sm mx-auto rounded-md" />
          </div>

          {/* Order Spec Snapshot Card Skeleton */}
          <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 sm:p-5 space-y-3.5 text-left">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-32 rounded-md" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-36 rounded-md" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-4 w-28 rounded-md" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-6 w-28 rounded-md" />
            </div>
          </div>

          {/* Action Buttons Skeleton */}
          <div className="space-y-3 pt-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </Card>
      </div>
    </StudioCardLayout>
  );
}
