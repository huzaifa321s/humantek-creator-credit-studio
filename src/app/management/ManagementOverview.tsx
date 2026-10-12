'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FolderKanban,
  MessageSquare,
  Receipt,
  Landmark,
  ArrowRight,
} from 'lucide-react';
import { AdminKpiStrip } from '@/components/management/AdminKpiStrip';
import { useManagementSummaryQuery } from '@/lib/queries/management';
import { useProjectsQuery } from '@/lib/queries/projects';
import { useStudioChat } from '@/lib/chatStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn, formatStudioDate } from '@/lib/utils';

export function ManagementOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Backwards compatibility redirect for legacy bookmarks / links with ?tab=
  useEffect(() => {
    if (tabParam === 'projects') {
      router.replace('/management/projects');
    } else if (tabParam === 'messages') {
      router.replace('/management/inbox');
    } else if (tabParam === 'wire-orders') {
      router.replace('/management/orders');
    } else if (tabParam === 'alerts') {
      router.replace('/management/alerts');
    } else if (tabParam === 'ledger') {
      router.replace('/management/ledger');
    }
  }, [tabParam, router]);

  const { data: summary, isPending: isSummaryLoading } = useManagementSummaryQuery();
  const { data: recentProjects = [], isPending: isProjectsLoading } = useProjectsQuery();
  const { unreadCounts } = useStudioChat();

  const totalUnreadMessages = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  const kpis = summary?.kpis || {
    totalRevenue: 0,
    activeOrdersCount: 0,
    pendingReviewCount: 0,
    totalCreditsAllocated: 0,
  };

  const counts = summary?.counts || {
    projects: 0,
    pendingReview: 0,
    wireOrders: 0,
    alerts: 0,
    ledger: 0,
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* 1. Authoritative Studio KPI Strip */}
      {isSummaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <AdminKpiStrip
          totalRevenue={kpis.totalRevenue}
          activeOrdersCount={kpis.activeOrdersCount}
          pendingReviewCount={kpis.pendingReviewCount}
          totalCreditsAllocated={kpis.totalCreditsAllocated}
        />
      )}

      {/* 2. Studio Workspaces Quick Access */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xs font-bold uppercase tracking-wider text-muted-foreground/90">
            Studio Workspaces
          </h2>
          <span className="text-3xs text-muted-foreground font-mono">Operations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Briefs Queue */}
          <Link href="/management/projects" className="block group">
            <Card className="p-4 sm:p-4.5 rounded-xl border border-border/80 bg-card shadow-2xs group-hover:border-amber-400/40 transition-all flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <FolderKanban className="size-4" />
                  </span>
                  {counts.pendingReview > 0 ? (
                    <Badge variant="gold" className="text-3xs font-bold px-1.5 py-0 h-4">
                      {counts.pendingReview} to review
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-3xs font-medium lowercase px-1.5 py-0 h-4 text-muted-foreground border-border/70 rounded-md"
                    >
                      {counts.projects} briefs
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Briefs Queue
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    Manage client briefs, delivery milestones, and stage sign-offs.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-1 text-xs font-semibold text-brand-text dark:text-amber-400 group-hover:underline">
                <span>Open Queue</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>

          {/* Card 2: Studio Desk (Communications) */}
          <Link href="/management/inbox" className="block group">
            <Card className="p-4 sm:p-4.5 rounded-xl border border-border/80 bg-card shadow-2xs group-hover:border-amber-400/40 transition-all flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <MessageSquare className="size-4" />
                  </span>
                  {totalUnreadMessages > 0 ? (
                    <Badge variant="destructive" className="text-3xs font-mono font-bold px-1.5 py-0 h-4 animate-pulse">
                      {totalUnreadMessages} new
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-3xs font-medium lowercase px-1.5 py-0 h-4 text-muted-foreground border-border/70 rounded-md"
                    >
                      live desk
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Studio Desk
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    Direct real-time conversations with creators across active briefs.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-1 text-xs font-semibold text-brand-text dark:text-amber-400 group-hover:underline">
                <span>Open Messages</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>

          {/* Card 3: Manual Payments */}
          <Link href="/management/orders" className="block group">
            <Card className="p-4 sm:p-4.5 rounded-xl border border-border/80 bg-card shadow-2xs group-hover:border-amber-400/40 transition-all flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <Landmark className="size-4" />
                  </span>
                  {counts.wireOrders > 0 ? (
                    <Badge variant="gold" className="text-3xs font-bold px-1.5 py-0 h-4">
                      {counts.wireOrders} pending
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-3xs font-medium lowercase px-1.5 py-0 h-4 text-muted-foreground border-border/70 rounded-md"
                    >
                      all clear
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Manual Payments
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    Review and confirm wire transfers, Payoneer receipts, and invoices.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-1 text-xs font-semibold text-brand-text dark:text-amber-400 group-hover:underline">
                <span>Review Orders</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>

          {/* Card 4: Credit Ledger */}
          <Link href="/management/ledger" className="block group">
            <Card className="p-4 sm:p-4.5 rounded-xl border border-border/80 bg-card shadow-2xs group-hover:border-amber-400/40 transition-all flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <Receipt className="size-4" />
                  </span>
                  <Badge
                    variant="outline"
                    className="text-3xs font-medium lowercase px-1.5 py-0 h-4 text-muted-foreground border-border/70 rounded-md"
                  >
                    audit log
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Credit Ledger
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    Audit package grants, balance top-ups, and studio redemptions.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-1 text-xs font-semibold text-brand-text dark:text-amber-400 group-hover:underline">
                <span>View Ledger</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* 3. Recent Project Briefs */}
      <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
        <CardHeader className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-border/70 bg-secondary/15 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 shrink-0 shadow-2xs">
              <FolderKanban className="size-3.5" />
            </span>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                Recent Project Briefs
              </CardTitle>
              <CardDescription className="text-2xs text-muted-foreground">
                Latest client briefs submitted across all packages
              </CardDescription>
            </div>
          </div>

          <Link href="/management/projects">
            <Button
              variant="ghost"
              size="xs"
              className="text-xs font-semibold gap-1 text-brand-text dark:text-amber-400 hover:bg-amber-400/15 rounded-md cursor-pointer"
            >
              <span>View All ({counts.projects})</span>
              <ArrowRight className="size-3" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {isProjectsLoading ? (
            <div className="p-4 sm:p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/10">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-3 w-48 rounded-md" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <Empty className="py-10 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-amber-400/15 text-brand-text dark:text-amber-400 size-9">
                  <FolderKanban className="size-4.5" />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-semibold tracking-tight">
                  No project briefs yet
                </EmptyTitle>
                <EmptyDescription className="text-xs text-muted-foreground leading-normal max-w-xs">
                  Client project briefs will appear here once submitted.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {recentProjects.slice(0, 5).map((project) => {
                const hasChannel = Boolean(
                  project.channelName &&
                  project.channelName.toLowerCase() !== project.clientName.toLowerCase()
                );
                const title = hasChannel
                  ? `${project.channelName} · ${project.packageName}`
                  : project.packageName || 'Creative Brief';

                return (
                  <div
                    key={project.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-3xs font-bold text-brand-text dark:text-amber-300 bg-amber-400/10 dark:bg-amber-400/15 px-1.5 py-0.5 rounded border border-amber-400/25 shrink-0">
                          {project.projectCode || project.id.slice(0, 8)}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-3xs font-medium lowercase px-1.5 py-0 h-4 shrink-0 text-muted-foreground border-border/70 rounded-md"
                        >
                          {project.status.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-3xs font-medium lowercase px-1.5 py-0 h-4 shrink-0 rounded-md',
                            project.paymentStatus === 'paid'
                              ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                              : 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          )}
                        >
                          {project.paymentStatus === 'paid' ? 'paid' : 'unpaid'}
                        </Badge>
                      </div>

                      <div className="text-2xs text-muted-foreground truncate">
                        <span>
                          Client: <b className="text-foreground/90 font-medium">{project.clientName}</b>
                        </span>
                        <span className="mx-1.5">·</span>
                        <span>{project.email}</span>
                        {project.createdAt && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span>{formatStudioDate(project.createdAt)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-foreground">
                          ${project.packagePrice.toLocaleString()} USD
                        </div>
                        <div className="text-2xs text-muted-foreground flex items-center justify-end gap-1 font-mono">
                          <CreditValue
                            value={project.packageCredits || project.usedCredits || 0}
                            size="xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link href={`/management/inbox?thread=${project.id}`}>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-7 px-2 text-2xs font-semibold gap-1 text-brand-text dark:text-amber-400 hover:bg-amber-400/15 rounded-md cursor-pointer"
                            title="Open in studio desk"
                          >
                            <MessageSquare className="size-3" />
                            <span className="hidden sm:inline">Chat</span>
                          </Button>
                        </Link>

                        <Link href={`/management/projects?project=${project.id}`}>
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-7 px-2.5 text-2xs font-semibold rounded-md border-border/80 hover:border-amber-400/50 hover:bg-secondary/40 cursor-pointer"
                          >
                            Manage
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
