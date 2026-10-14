'use client';

import React, { Suspense } from 'react';
import { AgencyDataGrid } from '@/components/AgencyDataGrid';
import { useManagementLedgerQuery } from '@/lib/queries/management';
import { Skeleton } from '@/components/ui/skeleton';

function InnerLedgerContent() {
  const { data, isPending } = useManagementLedgerQuery({ limit: 100 });
  const transactions = data?.transactions || [];
  const customers = data?.customers || [];

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <AgencyDataGrid transactions={transactions} customers={customers} />
    </div>
  );
}

export function LedgerPageContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <InnerLedgerContent />
    </Suspense>
  );
}
