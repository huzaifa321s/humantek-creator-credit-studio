import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { AlertsPageContent } from './AlertsPageContent';

export const dynamic = 'force-dynamic';

export default async function ManagementAlertsPage() {
  await requireAdmin();
  return <AlertsPageContent />;
}
