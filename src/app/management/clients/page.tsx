import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { ClientsPageContent } from './ClientsPageContent';

export const dynamic = 'force-dynamic';

export default async function ManagementClientsPage() {
  await requireAdmin();
  return <ClientsPageContent />;
}
