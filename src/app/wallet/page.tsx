'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Ticket,
  Search,
  Receipt,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';
import { useUserStore } from '@/lib/userStore';
import { useWalletQuery } from '@/lib/queries/wallet';
import type { CreditLedgerEntry } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { formatStudioDate } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  ResponsiveTableShell,
  ResponsiveDesktopView,
  MobileCardList,
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardBody,
  MobileDataCardFooter,
} from '@/components/ui/table';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';

type LedgerFilterTab = 'all' | 'added' | 'used';

function ClientLedgerTypeBadge({ type }: { type: CreditLedgerEntry['type'] }) {
  if (type === 'package_purchase') {
    return (
      <Badge variant="success" className="text-2xs font-semibold px-2 py-0.5">
        Package Purchase
      </Badge>
    );
  }
  if (type === 'redeem_code' || type === 'promo_credit' || type === 'manual_topup') {
    return (
      <Badge variant="gold" className="text-2xs font-semibold px-2 py-0.5">
        Promo Code
      </Badge>
    );
  }
  if (type === 'refund') {
    return (
      <Badge variant="destructive" className="text-2xs font-semibold px-2 py-0.5">
        Refund
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-2xs font-semibold text-brand-text dark:text-amber-400 border-amber-400/30 px-2 py-0.5"
    >
      Service Scope
    </Badge>
  );
}

function ClientLedgerStatus({ status }: { status?: CreditLedgerEntry['status'] }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-brand-text dark:text-amber-400 font-medium">
        <Clock className="size-3" /> Pending
      </span>
    );
  }
  if (status === 'reversed') {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
        <RotateCcw className="size-3" /> Reversed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
      <CheckCircle2 className="size-3" /> Settled
    </span>
  );
}

export default function ClientWalletLedgerPage() {
  const router = useRouter();
  const { user, isHydrated } = useUserStore();
  const [activeTab, setActiveTab] = useState<LedgerFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: walletData, isLoading } = useWalletQuery(user?.email);

  const walletBalance = walletData?.walletBalance ?? user?.walletBalance ?? 0;
  const balancePurchased = walletData?.balancePurchased ?? walletBalance;
  const balancePromo = walletData?.balancePromo ?? 0;

  const ledgerEntries = useMemo(() => walletData?.ledger ?? [], [walletData?.ledger]);

  const summary = useMemo(() => {
    let settledAdded = 0;
    let pendingAdded = 0;
    let settledUsed = 0;
    let pendingUsed = 0;
    let addedCount = 0;
    let usedCount = 0;

    for (const entry of ledgerEntries) {
      if (entry.creditsDelta > 0) addedCount += 1;
      if (entry.creditsDelta < 0) usedCount += 1;

      if (entry.status === 'reversed') continue;
      const isPending = entry.status === 'pending';

      if (entry.creditsDelta > 0) {
        if (isPending) pendingAdded += entry.creditsDelta;
        else settledAdded += entry.creditsDelta;
      } else if (entry.creditsDelta < 0) {
        const abs = Math.abs(entry.creditsDelta);
        if (isPending) pendingUsed += abs;
        else settledUsed += abs;
      }
    }

    return {
      settledAdded,
      pendingAdded,
      totalAdded: settledAdded + pendingAdded,
      settledUsed,
      pendingUsed,
      totalUsed: settledUsed + pendingUsed,
      addedCount,
      usedCount,
    };
  }, [ledgerEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return ledgerEntries.filter((entry) => {
      if (activeTab === 'added' && entry.creditsDelta <= 0) return false;
      if (activeTab === 'used' && entry.creditsDelta >= 0) return false;

      if (q) {
        const refMatch = (entry.referenceId || '').toLowerCase().includes(q);
        const descMatch = (entry.description || '').toLowerCase().includes(q);
        const typeMatch = entry.type.toLowerCase().includes(q);
        if (!refMatch && !descMatch && !typeMatch) return false;
      }

      return true;
    });
  }, [ledgerEntries, activeTab, searchQuery]);

  const showSkeleton = !isHydrated || (isLoading && !walletData);

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={<StudioNewProjectButton />}
    >
      <div className="space-y-6 pb-24 sm:pb-32 animate-in fade-in duration-200">
        {/* Top Header — exact same pattern as My Projects & Notifications */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Credit History
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Track your credit balance, package allocations, promo codes, and project usage.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            render={<Link href="/redeem-code" />}
            nativeButton={false}
            className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer self-start sm:self-auto"
          >
            <Ticket className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
            <span>Redeem Promo Code</span>
          </Button>
        </div>

        {/* 3 Compact Summary KPI Cards — exact same pattern as AgencyDataGrid */}
        {showSkeleton ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Available Credits */}
            <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Available Credits</span>
                <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
                  <Wallet className="size-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-1">
                <CreditValue value={walletBalance} size="lg" />
                <span className="text-2xs text-muted-foreground font-mono">
                  {balancePromo > 0
                    ? `${balancePurchased} pkg · ${balancePromo} promo`
                    : 'net remaining'}
                </span>
              </div>
            </div>

            {/* Card 2: Credits Added (+CR) */}
            <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Credits Added</span>
                <span className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="size-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-1">
                <CreditValue value={`+${summary.totalAdded}`} size="lg" variant="delta" />
                <span className="text-2xs text-muted-foreground font-mono">
                  {summary.settledAdded} settled
                  {summary.pendingAdded > 0 ? ` · ${summary.pendingAdded} pending` : ''}
                </span>
              </div>
            </div>

            {/* Card 3: Credits Used (-CR) */}
            <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Credits Used</span>
                <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
                  <TrendingDown className="size-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-1">
                <CreditValue
                  value={summary.totalUsed > 0 ? `-${summary.totalUsed}` : '0'}
                  size="lg"
                  variant="delta"
                />
                <span className="text-2xs text-muted-foreground font-mono">
                  {summary.settledUsed} settled
                  {summary.pendingUsed > 0 ? ` · ${summary.pendingUsed} pending` : ''}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar with Tabs and Search — same compact style as My Projects */}
        {!showSkeleton && ledgerEntries.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FilterTabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as LedgerFilterTab)}
              size="sm"
              tabs={[
                { value: 'all', label: 'All', count: ledgerEntries.length },
                { value: 'added', label: 'Credits Added', count: summary.addedCount },
                { value: 'used', label: 'Credits Used', count: summary.usedCount },
              ]}
            />

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="Search by code or activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-card border-border/80 rounded-lg focus-visible:border-amber-400"
              />
            </div>
          </div>
        )}

        {/* Main Content: Skeleton / Empty / Responsive Table */}
        {showSkeleton ? (
          <Skeleton className="h-80 w-full rounded-xl" />
        ) : ledgerEntries.length === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-12 sm:p-14 shadow-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Receipt className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold text-foreground">
                No credit history yet
              </EmptyTitle>
              <EmptyDescription className="text-muted-foreground text-sm">
                Start a project or redeem a promo code to see your credit transactions here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <Button
                  variant="default"
                  className="text-sm font-bold h-10 px-5 gap-2 bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground cursor-pointer shadow-xs shadow-amber-400/20"
                  render={<Link href="/new-project" />}
                  nativeButton={false}
                >
                  <Sparkles className="size-4" />
                  Start a project
                </Button>
                <Button
                  variant="outline"
                  className="text-sm font-semibold h-10 px-4 gap-2 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer"
                  render={<Link href="/redeem-code" />}
                  nativeButton={false}
                >
                  <Ticket className="size-4 text-brand-text dark:text-amber-400" />
                  Redeem Promo Code
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        ) : filteredEntries.length === 0 ? (
          <Empty className="p-10 border border-dashed rounded-xl bg-secondary/20">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-lg">
                <Receipt className="w-6 h-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-base font-bold">No Credit Records Found</EmptyTitle>
              <EmptyDescription className="text-xs sm:text-sm">
                No transactions match your current filter or search.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold rounded-lg cursor-pointer"
              >
                Reset Filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ResponsiveTableShell>
            {/* MOBILE VIEW (< md): Scannable Transaction Cards */}
            <MobileCardList>
              {filteredEntries.map((entry) => {
                const projectHref = entry.projectId
                  ? `/projects?project=${encodeURIComponent(entry.projectId)}`
                  : undefined;

                return (
                  <MobileDataCard
                    key={entry.id}
                    className="space-y-2.5"
                    onClick={projectHref ? () => router.push(projectHref) : undefined}
                  >
                    <MobileDataCardHeader>
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-brand-text dark:text-amber-400 text-xs truncate">
                          {entry.referenceId || 'STUDIO-CR'}
                        </div>
                        {entry.description && (
                          <div className="text-2xs text-muted-foreground truncate mt-0.5">
                            {entry.description}
                          </div>
                        )}
                      </div>
                      <ClientLedgerTypeBadge type={entry.type} />
                    </MobileDataCardHeader>

                    <MobileDataCardBody className="items-center text-xs">
                      <div className="font-medium text-muted-foreground text-2xs font-mono tabular-nums">
                        {formatStudioDate(entry.createdAt)}
                      </div>
                      <div className="inline-flex items-center gap-1 text-2xs">
                        <ClientLedgerStatus status={entry.status} />
                      </div>
                    </MobileDataCardBody>

                    <MobileDataCardFooter className="flex-row items-center pt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-2xs text-muted-foreground font-medium">Credits:</span>
                        <CreditValue
                          value={
                            entry.creditsDelta > 0
                              ? `+${entry.creditsDelta}`
                              : `${entry.creditsDelta}`
                          }
                          size="xs"
                          variant="delta"
                        />
                      </div>
                      {entry.usdAmount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-2xs text-muted-foreground font-medium">Amount:</span>
                          <span className="font-bold text-foreground text-xs font-mono tabular-nums">
                            ${entry.usdAmount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      )}
                    </MobileDataCardFooter>
                  </MobileDataCard>
                );
              })}
            </MobileCardList>

            {/* DESKTOP VIEW (md+): Clean Studio Table */}
            <ResponsiveDesktopView>
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border/80 hover:bg-transparent select-none">
                    <TableHead className="pl-5 font-bold text-xs text-foreground/80 h-11">
                      Reference &amp; Activity
                    </TableHead>
                    <TableHead className="font-bold text-xs text-foreground/80 h-11">
                      Type
                    </TableHead>
                    <TableHead className="font-bold text-xs text-foreground/80 text-right h-11">
                      Credits
                    </TableHead>
                    <TableHead className="pr-5 font-bold text-xs text-foreground/80 text-right h-11">
                      Date &amp; Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const projectHref = entry.projectId
                      ? `/projects?project=${encodeURIComponent(entry.projectId)}`
                      : undefined;

                    return (
                      <TableRow
                        key={entry.id}
                        className={`hover:bg-muted/40 transition-colors border-b border-border/60 ${
                          projectHref ? 'cursor-pointer' : ''
                        }`}
                        onClick={projectHref ? () => router.push(projectHref) : undefined}
                      >
                        {/* Reference & Description */}
                        <TableCell className="pl-5 text-xs">
                          <div className="font-mono font-bold text-brand-text dark:text-amber-400">
                            {entry.referenceId || 'STUDIO-CR'}
                          </div>
                          {entry.description && (
                            <div
                              className="text-2xs text-muted-foreground max-w-[340px] truncate mt-0.5"
                              title={entry.description}
                            >
                              {entry.description}
                            </div>
                          )}
                        </TableCell>

                        {/* Type Badge */}
                        <TableCell>
                          <ClientLedgerTypeBadge type={entry.type} />
                        </TableCell>

                        {/* Credits Delta */}
                        <TableCell className="text-right text-xs">
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <CreditValue
                              value={
                                entry.creditsDelta > 0
                                  ? `+${entry.creditsDelta}`
                                  : `${entry.creditsDelta}`
                              }
                              size="sm"
                              variant="delta"
                            />
                            {entry.usdAmount > 0 && (
                              <span className="text-2xs text-muted-foreground font-mono tabular-nums">
                                ${entry.usdAmount.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Date & Status */}
                        <TableCell className="pr-5 text-right text-xs">
                          <div className="font-medium text-foreground text-2xs font-mono tabular-nums">
                            {formatStudioDate(entry.createdAt)}
                          </div>
                          <div className="inline-flex items-center gap-1 text-2xs text-muted-foreground mt-0.5">
                            <ClientLedgerStatus status={entry.status} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveDesktopView>
          </ResponsiveTableShell>
        )}
      </div>
    </StudioCardLayout>
  );
}
