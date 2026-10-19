import React from 'react';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { BillingHistory } from '@/components/billing/BillingHistory';

export const dynamic = 'force-dynamic';

export default async function ManagementBillingPage() {
  const user = await requireAdmin();
  // Billing is limited to Owner and Manager accounts.
  if (!user.canManageProjects) {
    redirect('/management');
  }
  return (
    <div className="space-y-6 pb-16">
      <BillingHistory scope="all" />
    </div>
  );
}
