'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
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
import { useUserStore } from '@/lib/userStore';
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  ResponsiveTableShell,
  ResponsiveDesktopView,
  MobileCardList,
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardBody,
  MobileDataCardFooter,
  MobileDataCardActions,
} from '@/components/ui/table';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  AdminProjectMobileCard,
  AdminProjectTableRow,
} from '@/components/management/AdminProjectsTable';

export function ManagementOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const { user } = useUserStore();

  // Backwards compatibility redirect for legacy bookmarks / links with ?tab=
  useEffect(() => {
    const idParam = searchParams.get('id') || searchParams.get('project') || searchParams.get('thread');
    const subtabParam = searchParams.get('subtab');
    if (subtabParam === 'chat' || tabParam === 'messages') {
      router.replace(idParam ? `/management/inbox?thread=${encodeURIComponent(idParam)}` : '/management/inbox');
    } else if (tabParam === 'projects') {
      const forwardParams = new URLSearchParams();
      if (idParam) forwardParams.set('project', idParam);
      const searchQ = searchParams.get('search');
      const customerQ = searchParams.get('customer');
      const statusQ = searchParams.get('status');
      if (searchQ) forwardParams.set('search', searchQ);
      if (customerQ) forwardParams.set('customer', customerQ);
      if (statusQ) forwardParams.set('status', statusQ);
      const qs = forwardParams.toString();
      router.replace(qs ? `/management/projects?${qs}` : '/management/projects');
    } else if (tabParam === 'orders' || tabParam === 'wire-orders' || tabParam === 'ledger' || tabParam === 'credits') {
      router.replace('/management/ledger');
    } else if (tabParam === 'team' || tabParam === 'team-access') {
      router.replace(user?.teamRole === 'owner' ? '/management/team' : '/management');
    }
  }, [tabParam, searchParams, router, user?.teamRole]);

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

  const handleSelectProject = useCallback(
    (id: string) => {
      router.push(`/management/projects?project=${encodeURIComponent(id)}`);
    },
    [router]
  );

  const handleOpenChat = useCallback(
    (id: string) => {
      router.push(`/management/inbox?thread=${encodeURIComponent(id)}`);
    },
    [router]
  );

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
                    <Badge variant="gold" size="sm" className="font-mono tabular-nums font-bold">
                      {counts.pendingReview} to review
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm" className="font-mono tabular-nums text-muted-foreground">
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
                  <span className="text-2xl font-black font-mono tabular-nums tracking-tight text-foreground">
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
                    <Badge variant="gold-solid" size="sm" className="font-mono tabular-nums">
                      {totalUnreadMessages} Unread
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm" className="text-muted-foreground">
                      Live Chat
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
                  <span className="text-2xl font-black font-mono tabular-nums tracking-tight text-foreground">
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

            {/* Card 3: Studio Revenue */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs hover:border-amber-400/50 transition-all flex flex-col justify-between group">
              <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="size-8 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <Landmark className="size-4" />
                  </span>
                  <Badge variant="success" size="sm">
                    Verified
                  </Badge>
                </div>

                <div>
                  <CardTitle className="text-base font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors">
                    Studio Revenue
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Total verified revenue across paid projects and credit packages.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-0 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono tabular-nums tracking-tight text-foreground">
                    ${kpis.totalRevenue.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">verified revenue</span>
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
                    <span>Review Revenue</span>
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
                    Ledger
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
                  <CreditValue value={kpis.totalCreditsAllocated} size="lg" />
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

      {/* 2. Recent Client Projects (Using Shared ResponsiveTableShell & AdminProject Row/Card Components) */}
      <div className="space-y-3">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 shrink-0 shadow-2xs">
              <FolderKanban className="size-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                Recent Client Projects
              </h2>
              <p className="text-xs text-muted-foreground">
                Latest client projects submitted across all packages
              </p>
            </div>
          </div>

          <Link href="/management/projects" className="self-start xs:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 gap-1.5 cursor-pointer text-xs font-semibold rounded-lg"
            >
              <span>View All Projects ({counts.projects})</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>

        <ResponsiveTableShell>
          {isProjectsLoading ? (
            <>
              <MobileCardList>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <MobileDataCard key={idx}>
                    <MobileDataCardHeader>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-24 rounded-md" />
                        <Skeleton className="h-5 w-28 rounded-md" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </MobileDataCardHeader>
                    <MobileDataCardBody>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-3 w-24 rounded-md" />
                      </div>
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </MobileDataCardBody>
                    <MobileDataCardFooter>
                      <Skeleton className="h-5 w-24 rounded-md" />
                      <MobileDataCardActions>
                        <Skeleton className="h-8 w-20 rounded-lg" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                      </MobileDataCardActions>
                    </MobileDataCardFooter>
                  </MobileDataCard>
                ))}
              </MobileCardList>

              <ResponsiveDesktopView>
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-secondary/20 border-b border-border/70">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Code</TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Client / Channel</TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Package</TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Production Status</TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Payment</TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">Credits</TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">Submitted</TableHead>
                      <TableHead sticky="right" className="w-[140px] py-3 px-4 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="p-4"><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                        <TableCell className="p-4"><Skeleton className="h-8 w-44 rounded-md" /></TableCell>
                        <TableCell className="p-4"><Skeleton className="h-5 w-32 rounded-md" /></TableCell>
                        <TableCell className="p-4"><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                        <TableCell className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell className="p-4 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-md" /></TableCell>
                        <TableCell className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto rounded-md" /></TableCell>
                        <TableCell sticky="right" className="p-4 text-right"><Skeleton className="h-8 w-24 ml-auto rounded-md" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveDesktopView>
            </>
          ) : recentProjects.length === 0 ? (
            <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-10 sm:p-12 shadow-xs my-6 mx-4">
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
            <>
              {/* MOBILE VIEW (< md): Shared AdminProjectMobileCard */}
              <MobileCardList>
                {recentProjects.slice(0, 5).map((project) => (
                  <AdminProjectMobileCard
                    key={project.id}
                    project={project}
                    onSelect={handleSelectProject}
                    onOpenChat={handleOpenChat}
                  />
                ))}
              </MobileCardList>

              {/* DESKTOP VIEW (md+): Shared AdminProjectTableRow inside Table */}
              <ResponsiveDesktopView>
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-secondary/20 border-b border-border/70">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                        Code
                      </TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                        Client / Channel
                      </TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                        Package
                      </TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                        Production Status
                      </TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                        Payment
                      </TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">
                        Credits
                      </TableHead>
                      <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">
                        Submitted
                      </TableHead>
                      <TableHead
                        sticky="right"
                        className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right"
                      >
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentProjects.slice(0, 5).map((project) => (
                      <AdminProjectTableRow
                        key={project.id}
                        project={project}
                        onSelect={handleSelectProject}
                        onOpenChat={handleOpenChat}
                      />
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveDesktopView>
            </>
          )}
        </ResponsiveTableShell>
      </div>
    </div>
  );
}

