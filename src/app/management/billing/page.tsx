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
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
          Billing
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Every client invoice, which platform the payment came from, and PDF downloads.
        </p>
      </div>
      <BillingHistory scope="all" />
    </div>
  );
}
