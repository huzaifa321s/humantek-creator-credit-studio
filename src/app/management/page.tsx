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
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        </div>
      }
    >
      <ManagementOverview />
    </Suspense>
  );
}
