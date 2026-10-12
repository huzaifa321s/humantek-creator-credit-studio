import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { LedgerPageContent } from './LedgerPageContent';

export const dynamic = 'force-dynamic';

export default async function ManagementLedgerPage() {
  await requireAdmin();
  return <LedgerPageContent />;
}
