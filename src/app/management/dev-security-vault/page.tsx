import React, { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';
import { DevSecurityVaultClient } from './DevSecurityVaultClient';

export const dynamic = 'force-dynamic';

export default async function DevSecurityVaultPage() {
  await requireAdmin();

  return (
    <Suspense
      fallback={
        <StudioPageLoader
          label="Decrypting developer security telemetry..."
          variant="overview"
          showHeader={false}
        />
      }
    >
      <DevSecurityVaultClient />
    </Suspense>
  );
}
