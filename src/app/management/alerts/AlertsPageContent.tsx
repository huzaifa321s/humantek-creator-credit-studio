'use client';

import React, { Suspense } from 'react';
import { AdminAlertsList } from '@/components/management/AdminAlertsList';
import { Skeleton } from '@/components/ui/skeleton';

function InnerAlertsContent() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <AdminAlertsList />
    </div>
  );
}

export function AlertsPageContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <InnerAlertsContent />
    </Suspense>
  );
}
