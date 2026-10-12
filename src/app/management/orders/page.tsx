import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { OrdersPageContent } from './OrdersPageContent';

export const dynamic = 'force-dynamic';

export default async function ManagementOrdersPage() {
  await requireAdmin();
  return <OrdersPageContent />;
}
