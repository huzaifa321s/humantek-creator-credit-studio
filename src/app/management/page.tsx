import React, { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth';
import { ManagementOverview } from './ManagementOverview';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

export default async function ManagementPage() {
  await requireAdmin();

  return (
    <Suspense
      fallback={
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      }
    >
      <ManagementOverview />
    </Suspense>
  );
}
