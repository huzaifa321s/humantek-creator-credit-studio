'use client';

import React, { Suspense } from 'react';
import { AgencyDataGrid } from '@/components/AgencyDataGrid';
import { useManagementLedgerQuery } from '@/lib/queries/management';
import { Skeleton } from '@/components/ui/skeleton';

function InnerLedgerContent() {
  const { data, isPending } = useManagementLedgerQuery({ limit: 100 });
  const transactions = data?.transactions || [];

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <AgencyDataGrid transactions={transactions} />
    </div>
  );
}

export function LedgerPageContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <InnerLedgerContent />
    </Suspense>
  );
}
