'use client';

import React, { Suspense, useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';
import {
  Users,
  Search,
  RotateCcw,
  Wallet,
  FolderKanban,
  MessageSquare,
  ArrowRight,
  ChevronLeft,
  Clock,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
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
  TablePaginationBar,
} from '@/components/ui/table';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditValue } from '@/components/ui/credit-value';
import { FilterTabs } from '@/components/ui/filter-tabs';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';
import { AdminProjectsTable, ProjectStatusDotBadge } from '@/components/management/AdminProjectsTable';
import { BillingHistory } from '@/components/billing/BillingHistory';
import { AgencyDataGrid } from '@/components/AgencyDataGrid';
import { useManagementLedgerQuery } from '@/lib/queries/management';
import { useProjectsQuery, useUpdateProjectStatus } from '@/lib/queries/projects';
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';
import { formatStudioDate, formatStudioRelativeTime, cn } from '@/lib/utils';
import type { ProjectRecord } from '@/types';

const PAGE_SIZE_TIERS = [5, 10, 25, 50] as const;

type ClientActivityTab = 'projects' | 'billing';

/** Old links used overview/credits/messages; fold them into the two remaining tabs. */
function normalizeClientTab(value: string | null | undefined): ClientActivityTab {
  return value === 'billing' || value === 'credits' ? 'billing' : 'projects';
}

function InnerClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topLoader = useTopLoader();
  const { setActiveProjectId } = useStudioChat();
  const canViewBilling = useUserStore(
    (s) => s.user?.teamRole === 'owner' || s.user?.teamRole === 'manager'
  );

  const selectedClientParam = (searchParams.get('client') || '').trim().toLowerCase();
  const activeTabParam = normalizeClientTab(searchParams.get('section'));

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<ClientActivityTab>(activeTabParam);

  useEffect(() => {
    setActiveTab(activeTabParam);
  }, [activeTabParam]);

  const { data: ledgerData, isPending: isLedgerPending } = useManagementLedgerQuery({
    limit: 500,
  });
  const { data: allProjects = [], isPending: isProjectsPending } = useProjectsQuery();
  const updateStatus = useUpdateProjectStatus();
  const isUpdatingId = updateStatus.isPending ? updateStatus.variables?.id ?? null : null;

  const handleUpdateStatus = useCallback(
    (
      id: string,
      newStatus: ProjectRecord['status'],
      newPayment?: ProjectRecord['paymentStatus'],
      prev?: {
        status: ProjectRecord['status'];
        paymentStatus?: ProjectRecord['paymentStatus'];
        paymentMethod?: ProjectRecord['paymentMethod'];
      },
      newPaymentMethod?: ProjectRecord['paymentMethod']
    ) => {
      updateStatus.mutate(
        { id, status: newStatus, paymentStatus: newPayment, paymentMethod: newPaymentMethod },
        {
          onSuccess: () => {
            const statusChanged = !prev || prev.status !== newStatus;
            const paymentChanged = Boolean(
              prev && newPayment && (prev.paymentStatus || 'unpaid') !== newPayment
            );
            if (statusChanged && paymentChanged) {
              toast.success(
                `Updated status to ${newStatus.replace(/_/g, ' ')} and payment to ${newPayment}`
              );
            } else if (paymentChanged && newPayment) {
              toast.success(`Updated payment status to ${newPayment}`);
            } else {
              toast.success(`Updated status to ${newStatus.replace(/_/g, ' ')}`);
            }
          },
          onError: (err) => toast.error(err.message || 'Failed to update status'),
        }
      );
    },
    [updateStatus]
  );

  const handleOpenChat = useCallback(
    (projectId: string) => {
      setActiveProjectId(projectId);
      topLoader.start();
      router.push(`/management/inbox?thread=${encodeURIComponent(projectId)}`);
    },
    [router, setActiveProjectId, topLoader]
  );

  const selectClient = useCallback(
    (email: string | null, section: ClientActivityTab = 'projects') => {
      const params = new URLSearchParams(searchParams.toString());
      if (email) {
        params.set('client', email.toLowerCase().trim());
        params.set('section', section);
      } else {
        params.delete('client');
        params.delete('section');
        params.delete('project');
      }
      const qs = params.toString();
      const targetUrl = qs ? `/management/clients?${qs}` : '/management/clients';
      topLoader.start();
      router.push(targetUrl, {
        scroll: true,
      });
      setActiveTab(section);
    },
    [router, searchParams, topLoader]
  );

  useEffect(() => {
    topLoader.done();
  }, [selectedClientParam, topLoader]);

  const handleSectionChange = useCallback(
    (val: string) => {
      const next = val as ClientActivityTab;
      setActiveTab(next);
      if (selectedClientParam) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('section', next);
        router.replace(`/management/clients?${params.toString()}`, { scroll: false });
      }
    },
    [router, searchParams, selectedClientParam]
  );

  // Merge customer summaries from ledger + projects so every client is represented with live metrics
  const clientsList = useMemo(() => {
    const ledgerCustomers = ledgerData?.customers || [];
    const map = new Map<
      string,
      {
        clientEmail: string;
        clientName: string;
        channelName: string;
        walletBalance: number;
        walletPurchased: number;
        walletPromo: number;
        settledCreditsAllocated: number;
        settledCreditsUsed: number;
        settledUsdVolume: number;
        pendingUsdVolume: number;
        projectCount: number;
        activeProjectsCount: number;
        deliveredProjectsCount: number;
        chatThreadsCount: number;
        lastActivityAt: string | null;
      }
    >();

    for (const c of ledgerCustomers) {
      const email = (c.clientEmail || '').toLowerCase().trim();
      if (!email) continue;
      map.set(email, {
        clientEmail: email,
        clientName: c.clientName || email.split('@')[0],
        channelName: '',
        walletBalance: c.walletBalance || 0,
        walletPurchased: c.walletPurchased || 0,
        walletPromo: c.walletPromo || 0,
        settledCreditsAllocated: c.settledCreditsAllocated || 0,
        settledCreditsUsed: c.settledCreditsUsed || 0,
        settledUsdVolume: c.settledUsdVolume || 0,
        pendingUsdVolume: c.pendingUsdVolume || 0,
        projectCount: c.projectCount || 0,
        activeProjectsCount: 0,
        deliveredProjectsCount: 0,
        chatThreadsCount: 0,
        lastActivityAt: null,
      });
    }

    for (const p of allProjects) {
      const email = (p.email || '').toLowerCase().trim();
      if (!email) continue;
      let entry = map.get(email);
      if (!entry) {
        entry = {
          clientEmail: email,
          clientName: p.clientName || email.split('@')[0],
          channelName: p.channelName || '',
          walletBalance: 0,
          walletPurchased: 0,
          walletPromo: 0,
          settledCreditsAllocated: 0,
          settledCreditsUsed: 0,
          settledUsdVolume: 0,
          pendingUsdVolume: 0,
          projectCount: 0,
          activeProjectsCount: 0,
          deliveredProjectsCount: 0,
          chatThreadsCount: 0,
          lastActivityAt: p.createdAt,
        };
        map.set(email, entry);
      } else {
        if (!entry.channelName && p.channelName) {
          entry.channelName = p.channelName;
        }
        if (p.clientName && entry.clientName === email.split('@')[0]) {
          entry.clientName = p.clientName;
        }
      }

      if (! ['cancelled', 'declined', 'delivered'].includes(p.status)) {
        entry.activeProjectsCount += 1;
      }
      if (p.status === 'delivered') {
        entry.deliveredProjectsCount += 1;
      }
      if (p.lastMessageAt || p.lastMessagePreview) {
        entry.chatThreadsCount += 1;
      }
      const latestTs = p.lastMessageAt || p.createdAt;
      if (!entry.lastActivityAt || new Date(latestTs) > new Date(entry.lastActivityAt)) {
        entry.lastActivityAt = latestTs;
      }
    }

    // Ensure project count is at least the number of projects in allProjects for that client
    for (const [email, entry] of map.entries()) {
      const clientProjs = allProjects.filter(
        (p) => (p.email || '').toLowerCase().trim() === email
      );
      if (clientProjs.length > entry.projectCount) {
        entry.projectCount = clientProjs.length;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.projectCount !== a.projectCount) return b.projectCount - a.projectCount;
      if (b.settledUsdVolume !== a.settledUsdVolume) return b.settledUsdVolume - a.settledUsdVolume;
      return a.clientName.localeCompare(b.clientName);
    });
  }, [ledgerData?.customers, allProjects]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clientsList;
    return clientsList.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.clientEmail.toLowerCase().includes(q) ||
        c.channelName.toLowerCase().includes(q)
    );
  }, [clientsList, searchQuery]);

  const selectedClient = useMemo(() => {
    if (!selectedClientParam) return null;
    return (
      clientsList.find((c) => c.clientEmail === selectedClientParam) || {
        clientEmail: selectedClientParam,
        clientName: selectedClientParam.split('@')[0],
        channelName: '',
        walletBalance: 0,
        walletPurchased: 0,
        walletPromo: 0,
        settledCreditsAllocated: 0,
        settledCreditsUsed: 0,
        settledUsdVolume: 0,
        pendingUsdVolume: 0,
        projectCount: 0,
        activeProjectsCount: 0,
        deliveredProjectsCount: 0,
        chatThreadsCount: 0,
        lastActivityAt: null,
      }
    );
  }, [clientsList, selectedClientParam]);

  const selectedClientProjects = useMemo(() => {
    if (!selectedClientParam) return [];
    return allProjects.filter(
      (p) => (p.email || '').toLowerCase().trim() === selectedClientParam
    );
  }, [allProjects, selectedClientParam]);

  if (isLedgerPending && isProjectsPending && !ledgerData) {
    return (
      <StudioPageLoader
        label="Loading studio clients..."
        variant="table"
        showHeader={false}
      />
    );
  }

  // ============================================================================
  // 1. DEDICATED SINGLE CLIENT 360° WORKSPACE VIEW (`?client=email`)
  // ============================================================================
  if (selectedClient) {
    const sectionTabs: { value: string; label: string; count?: number }[] = [
      { value: 'projects', label: 'Projects', count: selectedClientProjects.length },
      { value: 'billing', label: 'Payments' },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Back to All Clients Bar + Client Identity Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border/80 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectClient(null)}
              className="h-8 px-2.5 text-xs font-semibold gap-1 rounded-lg cursor-pointer shrink-0"
            >
              <ChevronLeft className="size-3.5" />
              <span>All Clients</span>
            </Button>

            <div className="size-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center font-black text-brand-text dark:text-amber-300 text-sm shrink-0 uppercase">
              {(selectedClient.clientName || selectedClient.clientEmail).slice(0, 2)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-foreground truncate">
                  {selectedClient.clientName}
                </h2>
                {selectedClient.channelName &&
                  selectedClient.channelName !== selectedClient.clientName && (
                    <Badge variant="gold" size="xs" className="font-semibold">
                      {selectedClient.channelName}
                    </Badge>
                  )}
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate select-all">
                {selectedClient.clientEmail}
              </p>
            </div>
          </div>

          {selectedClientProjects.length > 0 && (
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={() => handleOpenChat(selectedClientProjects[0].id)}
                className="h-8 px-3.5 text-xs font-bold gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
              >
                <MessageSquare className="size-3.5" />
                <span>Message client</span>
              </Button>
            </div>
          )}
        </div>

        {/* 3 plain-language summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Credits left</span>
              <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
                <Wallet className="size-3.5" />
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <CreditValue value={selectedClient.walletBalance} size="lg" />
              <span className="text-2xs text-muted-foreground">available to spend</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Total paid</span>
              <span className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <DollarSign className="size-3.5" />
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className="text-lg font-black font-mono tabular-nums text-foreground">
                ${selectedClient.settledUsdVolume.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-2xs text-muted-foreground">
                {selectedClient.pendingUsdVolume > 0
                  ? `+$${selectedClient.pendingUsdVolume.toLocaleString('en-US')} waiting`
                  : 'all confirmed'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Projects</span>
              <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
                <FolderKanban className="size-3.5" />
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className="text-lg font-black font-mono tabular-nums text-foreground">
                {selectedClient.projectCount}
              </span>
              <span className="text-2xs text-muted-foreground">
                {selectedClient.activeProjectsCount} in progress · {selectedClient.deliveredProjectsCount} done
              </span>
            </div>
          </div>
        </div>

        {/* Two tabs only: Projects (messages live inside each project) and Payments */}
        <FilterTabs
          value={activeTab}
          onValueChange={handleSectionChange}
          tabs={sectionTabs}
          size="sm"
        />

        {activeTab === 'projects' && (
          <AdminProjectsTable
            key={`tab-proj-${selectedClient.clientEmail}`}
            projects={selectedClientProjects}
            lockedCustomer={selectedClient.clientEmail}
            onOpenChat={handleOpenChat}
            onUpdateStatus={handleUpdateStatus}
            isUpdatingId={isUpdatingId}
          />
        )}

        {activeTab === 'billing' && (
          <div className="space-y-6">
            {canViewBilling && (
              <section className="space-y-2.5">
                <h3 className="text-sm font-bold text-foreground">Invoices</h3>
                <BillingHistory scope="all" customerEmail={selectedClient.clientEmail} />
              </section>
            )}
            <section className="space-y-2.5">
              <h3 className="text-sm font-bold text-foreground">Credit activity</h3>
              <AgencyDataGrid
                transactions={ledgerData?.transactions || []}
                customers={ledgerData?.customers || []}
                sharedPromos={ledgerData?.sharedPromos || []}
                customerFilter={selectedClient.clientEmail}
              />
            </section>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // 2. ALL STUDIO CLIENTS DIRECTORY VIEW (`/management/clients`)
  // ============================================================================
  const maxNeededTier =
    PAGE_SIZE_TIERS.find((t) => t >= Math.max(filteredClients.length, 5)) ??
    PAGE_SIZE_TIERS[PAGE_SIZE_TIERS.length - 1];
  const availablePageSizes = PAGE_SIZE_TIERS.filter((t) => t <= maxNeededTier);
  const effectivePageSize = Math.min(pageSize, maxNeededTier);

  const totalCount = filteredClients.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const activePage = Math.min(page, totalPages);
  const startIndex = (activePage - 1) * effectivePageSize;
  const fromIndex = totalCount === 0 ? 0 : startIndex + 1;
  const toIndex = Math.min(startIndex + effectivePageSize, totalCount);
  const pageClients = filteredClients.slice(startIndex, startIndex + effectivePageSize);

  const totalStudioWalletCredits = clientsList.reduce((acc, c) => acc + c.walletBalance, 0);
  const totalPaidUsd = clientsList.reduce((acc, c) => acc + c.settledUsdVolume, 0);
  const totalActiveProjects = clientsList.reduce((acc, c) => acc + c.activeProjectsCount, 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Studio Clients Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Studio Clients</span>
            <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
              <Users className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <span className="text-xl font-black font-mono tabular-nums text-foreground">
              {clientsList.length}
            </span>
            <span className="text-2xs text-muted-foreground font-mono">registered creators</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Active Client Projects</span>
            <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
              <FolderKanban className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <span className="text-xl font-black font-mono tabular-nums text-foreground">
              {totalActiveProjects}
            </span>
            <span className="text-2xs text-muted-foreground font-mono">in pipeline</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Client Wallet Balance</span>
            <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
              <Wallet className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <CreditValue value={totalStudioWalletCredits} size="lg" />
            <span className="text-2xs text-muted-foreground font-mono">available across wallets</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Paid Client Volume</span>
            <span className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <span className="text-xl font-black font-mono tabular-nums text-foreground">
              ${totalPaidUsd.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-2xs text-muted-foreground font-mono">settled revenue</span>
          </div>
        </div>
      </div>

      {/* Search & Showing Count Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
          <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search client by name, channel, or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-8 text-xs bg-card rounded-lg border-border/80 focus-visible:border-amber-400"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            Showing <b className="text-foreground">{fromIndex}–{toIndex}</b> of{' '}
            <b className="text-foreground">{totalCount}</b>
          </span>

          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Clients Table / Mobile Cards */}
      {filteredClients.length === 0 ? (
        <Empty className="p-10 border border-dashed rounded-xl bg-secondary/20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users className="size-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-bold">No Matching Clients</EmptyTitle>
            <EmptyDescription className="text-xs sm:text-sm">
              No clients matched your search query.
            </EmptyDescription>
          </EmptyHeader>
          {searchQuery && (
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold rounded-lg cursor-pointer"
              >
                Reset Search
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ResponsiveTableShell>
          {/* Mobile View */}
          <MobileCardList>
            {pageClients.map((client) => (
              <MobileDataCard
                key={client.clientEmail}
                onClick={() => selectClient(client.clientEmail)}
                className="space-y-2.5"
              >
                <MobileDataCardHeader>
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-xs truncate">
                      {client.clientName}
                    </div>
                    <div className="text-2xs text-muted-foreground font-mono truncate">
                      {client.clientEmail}
                    </div>
                  </div>
                  <CreditValue value={client.walletBalance} size="xs" variant="pill" />
                </MobileDataCardHeader>

                <MobileDataCardBody className="text-xs">
                  <div className="text-2xs text-muted-foreground">
                    <b className="text-foreground">{client.projectCount}</b> projects (
                    {client.activeProjectsCount} active)
                  </div>
                  <div className="font-mono font-bold text-foreground text-xs tabular-nums">
                    ${client.settledUsdVolume.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </MobileDataCardBody>

                <MobileDataCardFooter>
                  <span className="text-2xs text-muted-foreground font-mono flex items-center gap-1">
                    <Clock className="size-3" />
                    {client.lastActivityAt
                      ? formatStudioRelativeTime(client.lastActivityAt)
                      : 'Active'}
                  </span>
                  <MobileDataCardActions>
                    <Button
                      type="button"
                      variant="gold"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectClient(client.clientEmail);
                      }}
                      className="h-8 px-3 text-xs font-bold gap-1 rounded-lg cursor-pointer"
                    >
                      <span>View Activity</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </MobileDataCardActions>
                </MobileDataCardFooter>
              </MobileDataCard>
            ))}
          </MobileCardList>

          {/* Desktop View */}
          <ResponsiveDesktopView>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border/80 hover:bg-transparent select-none">
                  <TableHead className="pl-5 font-bold text-xs text-foreground/80 h-11">
                    Client
                  </TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 h-11">
                    Wallet Balance
                  </TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 h-11">
                    Projects
                  </TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 text-right h-11">
                    Paid Spend
                  </TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 text-right h-11">
                    Last Activity
                  </TableHead>
                  <TableHead className="pr-5 font-bold text-xs text-foreground/80 text-right h-11">
                    Workspace
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageClients.map((client) => (
                  <TableRow
                    key={client.clientEmail}
                    onClick={() => selectClient(client.clientEmail)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/60"
                  >
                    <TableCell className="pl-5 py-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center font-bold text-brand-text dark:text-amber-300 text-xs shrink-0 uppercase">
                          {(client.clientName || client.clientEmail).slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                            <span>{client.clientName}</span>
                            {client.channelName && client.channelName !== client.clientName && (
                              <span className="text-2xs text-muted-foreground font-normal">
                                ({client.channelName})
                              </span>
                            )}
                          </div>
                          <div className="text-2xs text-muted-foreground font-mono truncate">
                            {client.clientEmail}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5">
                      <CreditValue value={client.walletBalance} size="xs" variant="pill" />
                    </TableCell>

                    <TableCell className="py-3.5 text-xs">
                      <span className="font-bold text-foreground font-mono">
                        {client.projectCount}
                      </span>{' '}
                      <span className="text-muted-foreground text-2xs">
                        ({client.activeProjectsCount} active · {client.deliveredProjectsCount}{' '}
                        done)
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5 text-right font-mono text-xs font-bold tabular-nums">
                      ${client.settledUsdVolume.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>

                    <TableCell className="py-3.5 text-right text-xs text-muted-foreground font-mono tabular-nums">
                      {client.lastActivityAt
                        ? formatStudioRelativeTime(client.lastActivityAt)
                        : '—'}
                    </TableCell>

                    <TableCell className="pr-5 py-3.5 text-right">
                      <Button
                        type="button"
                        variant="gold"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectClient(client.clientEmail);
                        }}
                        className="h-8 px-3 text-xs font-bold gap-1 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
                      >
                        <span>View Client</span>
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveDesktopView>

          <TablePaginationBar
            page={activePage}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            pageSizeOptions={availablePageSizes}
            totalCount={totalCount}
            fromIndex={fromIndex}
            toIndex={toIndex}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </ResponsiveTableShell>
      )}
    </div>
  );
}

export function ClientsPageContent() {
  return (
    <Suspense
      fallback={
        <StudioPageLoader
          label="Loading studio clients..."
          variant="table"
          showHeader={false}
        />
      }
    >
      <InnerClientsPage />
    </Suspense>
  );
}
