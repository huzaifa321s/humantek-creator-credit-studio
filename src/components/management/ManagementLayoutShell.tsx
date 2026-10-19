'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { useUserStore } from '@/lib/userStore';
import { ShieldCheck, Eye } from 'lucide-react';

const ROUTE_HEADERS: Record<string, { title: string; description: string }> = {
  '/management': {
    title: 'Studio Overview',
    description: 'Real-time project pipeline, creator inquiries, and studio operations.',
  },
  '/management/projects': {
    title: 'Client Projects',
    description: 'Track client orders, production stages, and delivery status.',
  },
  '/management/clients': {
    title: 'Studio Clients',
    description: 'See each client’s credits, projects, billing, and messages.',
  },
  '/management/inbox': {
    title: 'Client Messages',
    description: 'Chat with clients and review project discussions in real time.',
  },
  '/management/ledger': {
    title: 'Credit History',
    description: 'Review all client credit purchases, deductions, and balance changes.',
  },
  '/management/team': {
    title: 'Team Access',
    description: 'Manage Owner, Manager, and Viewer access to the studio management console.',
  },
  '/management/billing': {
    title: 'Billing',
    description: 'Every client invoice, which platform the payment came from, and PDF downloads.',
  },
};

function getRoleDisplayLabel(teamRole?: string | null): string {
  switch ((teamRole || '').toLowerCase()) {
    case 'owner':
      return 'Owner';
    case 'viewer':
      return 'Viewer';
    case 'manager':
    default:
      return 'Manager';
  }
}

export function ManagementLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUserStore();
  const isInbox = pathname.startsWith('/management/inbox');

  const teamRoleLabel = getRoleDisplayLabel(user?.teamRole);
  const isViewer = user?.teamRole === 'viewer';
  const signedInName = user?.name || (user?.email ? user.email.split('@')[0] : 'Studio Admin');

  const roleBadge = isViewer ? (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border/80 shadow-2xs">
      <Eye className="size-3.5 text-muted-foreground shrink-0" />
      <span>Viewer · Read-Only</span>
    </div>
  ) : (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-400/10 text-brand-text dark:text-amber-300 border border-amber-400/30 shadow-2xs">
      <ShieldCheck className="size-3.5 text-amber-500 shrink-0" />
      <span>{teamRoleLabel} Access</span>
    </div>
  );

  if (isInbox) {
    return (
      <StudioCardLayout
        mode="standalone"
        fullBleed={true}
        backLabel="Back to Studio"
        topRightBadge={roleBadge}
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
      description: 'Manage creator projects, workflows, and studio communications.',
    };

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={roleBadge}
    >
      <div className="space-y-6 pb-24 sm:pb-32 animate-in fade-in duration-200">
        {/* Top Header matching the clean standard of ProjectsPage.tsx */}
        <div className="border-b border-border/60 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-3xs font-extrabold uppercase tracking-widest text-muted-foreground/80 mb-1">
              MANAGEMENT CONSOLE
            </div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {currentHeader.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              {currentHeader.description}
            </p>
          </div>

          <div className="text-xs text-muted-foreground font-medium shrink-0">
            Signed in as <span className="text-foreground font-semibold">{signedInName}</span> ·{' '}
            <span className="text-brand-text dark:text-amber-300 font-bold">{teamRoleLabel}</span>
          </div>
        </div>

        <div className="min-h-[500px]">
          {children}
        </div>
      </div>
    </StudioCardLayout>
  );
}

