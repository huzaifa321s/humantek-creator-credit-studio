import React, { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth';
import { ManagementOverview } from './ManagementOverview';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';

export const dynamic = 'force-dynamic';

export default async function ManagementPage() {
  await requireAdmin();

  return (
    <Suspense
      fallback={
        <StudioPageLoader
          label="Syncing studio overview..."
          variant="overview"
          showHeader={false}
        />
      }
    >
      <ManagementOverview />
    </Suspense>
  );
}
