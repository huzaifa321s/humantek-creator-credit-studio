'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminInbox } from '@/components/management/AdminInbox';
import { Skeleton } from '@/components/ui/skeleton';

function InnerInboxContent() {
  const searchParams = useSearchParams();
  const threadId = searchParams.get('thread');
  const clientId = searchParams.get('client');

  return (
    <div className="w-full h-full max-h-full flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-200">
      <AdminInbox initialProjectId={threadId} initialClientId={clientId} />
    </div>
  );
}

export function InboxPageContent() {
  return (
    <Suspense
      fallback={
        <div className="h-[600px] border border-border/80 rounded-xl p-4 space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[500px]">
            <Skeleton className="h-full w-full rounded-lg" />
            <Skeleton className="h-full w-full col-span-2 rounded-lg" />
          </div>
        </div>
      }
    >
      <InnerInboxContent />
    </Suspense>
  );
}
