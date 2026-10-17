'use client';

import { StudioCardLayout } from '@/components/StudioCardLayout';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';
import { BillingHistory } from '@/components/billing/BillingHistory';

export default function BillingPage() {
  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={<StudioNewProjectButton />}
    >
      <div className="space-y-6 pb-24 sm:pb-32 animate-in fade-in duration-200">
        <div className="border-b border-border/60 pb-5">
          <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
            Billing
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Your invoices, how each order was paid, and PDF downloads.
          </p>
        </div>
        <BillingHistory scope="mine" />
      </div>
    </StudioCardLayout>
  );
}
