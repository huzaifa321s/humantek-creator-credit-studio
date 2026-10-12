'use client';

import React, { Suspense } from 'react';
import { AdminManualOrders } from '@/components/management/AdminManualOrders';
import { Skeleton } from '@/components/ui/skeleton';

function InnerOrdersContent() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <AdminManualOrders />
    </div>
  );
}

export function OrdersPageContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <InnerOrdersContent />
    </Suspense>
  );
}
