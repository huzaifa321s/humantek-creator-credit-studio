'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminInbox } from '@/components/management/AdminInbox';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';

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
        <div className="p-3.5 sm:p-5 h-full">
          <StudioPageLoader
            label="Loading client messages..."
            variant="chat"
            showHeader={false}
          />
        </div>
      }
    >
      <InnerInboxContent />
    </Suspense>
  );
}
