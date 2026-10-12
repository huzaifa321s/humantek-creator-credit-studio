'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ShieldCheck } from 'lucide-react';

const ROUTE_HEADERS: Record<string, { title: string; description: string }> = {
  '/management': {
    title: 'Studio Overview',
    description: 'Real-time brief pipeline, creator inquiries, and studio operations.',
  },
  '/management/projects': {
    title: 'Project Briefs Queue',
    description: 'Track client briefs, milestone approvals, and delivery status.',
  },
  '/management/orders': {
    title: 'Manual Payment Orders',
    description: 'Review and verify offline payments, wire transfers, and receipts.',
  },
  '/management/ledger': {
    title: 'Studio Credit Ledger',
    description: 'Audit credit allocations, redemptions, and package grants.',
  },
  '/management/alerts': {
    title: 'Studio Alerts',
    description: 'Review flagged transactions, refund requests, and notifications.',
  },
};

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

  const currentHeader =
    ROUTE_HEADERS[pathname] || {
      title: 'Studio Management',
      description: 'Manage creator briefs, workflows, and studio communications.',
    };

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
      <div className="space-y-6 pb-24 sm:pb-32 animate-in fade-in duration-200">
        {/* Top Header matching the clean standard of ProjectsPage.tsx */}
        <div className="border-b border-border/60 pb-5">
          <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
            {currentHeader.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            {currentHeader.description}
          </p>
        </div>

        <div className="min-h-[500px]">
          {children}
        </div>
      </div>
    </StudioCardLayout>
  );
}
