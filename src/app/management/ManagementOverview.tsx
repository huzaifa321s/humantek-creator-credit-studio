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
import { useManagementSummaryQuery } from '@/lib/queries/management';
import { useProjectsQuery } from '@/lib/queries/projects';
import { useStudioChat } from '@/lib/chatStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import { MobileDataCardActions } from '@/components/ui/table';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn, formatStudioDate, getProjectStatusLabel } from '@/lib/utils';

export function ManagementOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Backwards compatibility redirect for legacy bookmarks / links with ?tab=
  useEffect(() => {
    const idParam = searchParams.get('id') || searchParams.get('project') || searchParams.get('thread');
    const subtabParam = searchParams.get('subtab');
    if (subtabParam === 'chat' || tabParam === 'messages') {
      router.replace(idParam ? `/management/inbox?thread=${encodeURIComponent(idParam)}` : '/management/inbox');
    } else if (tabParam === 'projects') {
      router.replace(idParam ? `/management/projects?project=${encodeURIComponent(idParam)}` : '/management/projects');
    } else if (tabParam === 'orders' || tabParam === 'wire-orders') {
      router.replace(idParam ? `/management/orders?id=${encodeURIComponent(idParam)}` : '/management/orders');
    } else if (tabParam === 'ledger' || tabParam === 'credits') {
      router.replace('/management/ledger');
    }
  }, [tabParam, searchParams, router]);

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
    ledger: 0,
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* 1. Studio Operational Workspaces Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xs font-bold uppercase tracking-wider text-muted-foreground/90">
            Studio Workspaces
          </h2>
          <span className="text-3xs text-muted-foreground font-mono">Operations</span>
        </div>

        {isSummaryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Client Projects */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs hover:border-amber-400/50 transition-all flex flex-col justify-between group">
              <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <FolderKanban className="size-4" />
                  </span>
                  {counts.pendingReview > 0 ? (
                    <Badge variant="gold" size="sm" className="font-bold">
                      {counts.pendingReview} to review
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm" className="text-muted-foreground">
                      {counts.projects} projects
                    </Badge>
                  )}
                </div>

                <div>
                  <CardTitle className="text-base font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Client Projects
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Manage client orders, production stages, and delivery status.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-0 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                    {counts.pendingReview}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    pending review ({counts.projects} total)
                  </span>
                </div>
              </CardContent>

              <CardFooter className="p-4 sm:p-5 pt-0 border-0">
                <Link href="/management/projects" className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-between group-hover:border-amber-400/50 group-hover:bg-amber-400/10 transition-colors cursor-pointer"
                  >
                    <span>View Projects</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Card 2: Client Messages */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs hover:border-amber-400/50 transition-all flex flex-col justify-between group">
              <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <MessageSquare className="size-4" />
                  </span>
                  {totalUnreadMessages > 0 ? (
                    <Badge variant="destructive" size="xs" className="font-mono font-bold animate-pulse">
                      {totalUnreadMessages} new
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm" className="text-muted-foreground">
                      live chat
                    </Badge>
                  )}
                </div>

                <div>
                  <CardTitle className="text-base font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Client Messages
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Chat with clients and review project discussions in real time.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-0 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                    {totalUnreadMessages}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {totalUnreadMessages === 1 ? 'unread inquiry' : 'unread inquiries'}
                  </span>
                </div>
              </CardContent>

              <CardFooter className="p-4 sm:p-5 pt-0 border-0">
                <Link href="/management/inbox" className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-between group-hover:border-amber-400/50 group-hover:bg-amber-400/10 transition-colors cursor-pointer"
                  >
                    <span>Open Messages</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Card 3: Manual Payments */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs hover:border-amber-400/50 transition-all flex flex-col justify-between group">
              <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <Landmark className="size-4" />
                  </span>
                  {counts.wireOrders > 0 ? (
                    <Badge variant="gold" size="sm" className="font-bold">
                      {counts.wireOrders} pending
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm">
                      all clear
                    </Badge>
                  )}
                </div>

                <div>
                  <CardTitle className="text-base font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Manual Payments
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Review and confirm wire transfers, Payoneer receipts, and invoices.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-0 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                    ${kpis.totalRevenue.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">verified revenue</span>
                </div>
              </CardContent>

              <CardFooter className="p-4 sm:p-5 pt-0 border-0">
                <Link href="/management/orders" className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-between group-hover:border-amber-400/50 group-hover:bg-amber-400/10 transition-colors cursor-pointer"
                  >
                    <span>Review Orders</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Card 4: Credit History */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs hover:border-amber-400/50 transition-all flex flex-col justify-between group">
              <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <Receipt className="size-4" />
                  </span>
                  <Badge variant="outline" size="sm" className="text-muted-foreground">
                    history
                  </Badge>
                </div>

                <div>
                  <CardTitle className="text-base font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Credit History
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Track all client credit purchases, deductions, and promo codes.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-0 pb-3">
                <div className="flex items-baseline gap-2">
                  <CreditValue value={kpis.totalCreditsAllocated} size="md" variant="pill" />
                  <span className="text-xs text-muted-foreground">allocated</span>
                </div>
              </CardContent>

              <CardFooter className="p-4 sm:p-5 pt-0 border-0">
                <Link href="/management/ledger" className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-between group-hover:border-amber-400/50 group-hover:bg-amber-400/10 transition-colors cursor-pointer"
                  >
                    <span>View History</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>

      {/* 2. Recent Client Projects */}
      <Card className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-secondary/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 shrink-0 shadow-2xs">
              <FolderKanban className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Recent Client Projects
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Latest client projects submitted across all packages
              </CardDescription>
            </div>
          </div>

          <Link href="/management/projects">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 cursor-pointer text-xs font-semibold"
            >
              <span>View All Projects ({counts.projects})</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {isProjectsLoading ? (
            <div className="p-4 sm:p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-secondary/10">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-3 w-48 rounded-md" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-10 sm:p-12 shadow-xs my-4 mx-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderKanban className="size-6 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle className="text-lg font-bold text-foreground">
                  No client projects yet
                </EmptyTitle>
                <EmptyDescription className="text-xs text-muted-foreground">
                  Client projects will appear here once submitted.
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
                    className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    {/* Left Column: Badges & Info */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          size="sm"
                          className="font-mono tabular-nums text-brand-text dark:text-amber-300 bg-amber-400/10 border-amber-400/30 font-bold shrink-0"
                        >
                          {project.projectCode || project.id.slice(0, 8)}
                        </Badge>
                        <Badge variant="gold" size="sm" className="font-bold shrink-0">
                          {title}
                        </Badge>
                        <Badge
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs font-medium text-foreground shrink-0"
                        >
                          <span
                            className={cn(
                              'size-2 rounded-full shrink-0',
                              project.status === 'pending_review' && 'bg-amber-400 animate-pulse',
                              project.status === 'payment_confirmed' && 'bg-emerald-500',
                              project.status === 'in_production' && 'bg-amber-400 animate-pulse',
                              project.status === 'review_round' && 'bg-purple-500',
                              project.status === 'delivered' && 'bg-emerald-500',
                              !['pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered'].includes(project.status) && 'bg-muted-foreground/50'
                            )}
                          />
                          <span>{getProjectStatusLabel(project.status)}</span>
                        </Badge>
                        <Badge
                          variant={project.paymentStatus === 'paid' ? 'success' : 'warning'}
                          size="sm"
                          className="shrink-0"
                        >
                          {project.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>
                          Client: <b className="text-foreground font-medium">{project.clientName}</b>
                        </span>
                        <span>·</span>
                        <span>{project.email}</span>
                        {project.createdAt && (
                          <>
                            <span>·</span>
                            <span className="font-mono tabular-nums">
                              {formatStudioDate(project.createdAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Values & Action Buttons */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-3 shrink-0 pt-2.5 md:pt-0 border-t border-border/40 md:border-t-0">
                      <div className="flex items-center gap-2.5 sm:block text-left md:text-right">
                        <div className="text-sm font-mono font-bold text-foreground tabular-nums">
                          ${project.packagePrice.toLocaleString()} USD
                        </div>
                        <div className="sm:mt-0.5">
                          <CreditValue
                            value={project.packageCredits || project.usedCredits || 0}
                            size="xs"
                            variant="pill"
                          />
                        </div>
                      </div>

                      <MobileDataCardActions>
                        <Link href={`/management/inbox?thread=${project.id}`}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full h-8 px-3 text-xs font-medium gap-1.5 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer"
                          >
                            <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
                            <span>Chat</span>
                          </Button>
                        </Link>

                        <Link href={`/management/projects?project=${project.id}`}>
                          <Button
                            type="button"
                            variant="gold"
                            size="sm"
                            className="w-full h-8 px-3 text-xs font-bold gap-1 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
                          >
                            <span>Manage</span>
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </Link>
                      </MobileDataCardActions>
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
