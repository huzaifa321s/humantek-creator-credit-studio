'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ShieldCheck } from 'lucide-react';

export function ManagementLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isInbox = pathname.startsWith('/management/inbox');

  if (isInbox) {
    return (
      <StudioCardLayout
        mode="standalone"
        fullBleed={true}
        backLabel="Back to Studio"
        topRightBadge={
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-400/10 text-brand-text dark:text-amber-300 border border-amber-400/30 shadow-2xs">
            <ShieldCheck className="size-3.5 text-amber-500 shrink-0" />
            <span>Admin Verified</span>
          </div>
        }
      >
        <div className="w-full h-full max-h-full flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-150">
          {children}
        </div>
      </StudioCardLayout>
    );
  }

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-400/10 text-brand-text dark:text-amber-300 border border-amber-400/30 shadow-2xs">
          <ShieldCheck className="size-3.5 text-amber-500 shrink-0" />
          <span>Admin Verified</span>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Agency Management Console
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Authoritative agency operations, client queues, real-time messaging, and financial audits.
          </p>
        </div>

        <div className="min-h-[500px] animate-in fade-in duration-200">
          {children}
        </div>
      </div>
    </StudioCardLayout>
  );
}
