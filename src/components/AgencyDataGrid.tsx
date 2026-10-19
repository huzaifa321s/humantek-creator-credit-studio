'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableFooter,
  ResponsiveTableShell,
  ResponsiveDesktopView,
  MobileCardList,
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardBody,
  MobileDataCardFooter,
  TablePaginationBar,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { CreditValue } from '@/components/ui/credit-value';
import { CustomerFilterCombobox } from '@/components/management/CustomerFilterCombobox';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  RotateCcw,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Gift,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { cn, formatStudioDate } from '@/lib/utils';

export interface SharedPromoTransferInfo {
  code: string;
  credits: number;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  note?: string;
  isClaimed: boolean;
  claimedAt?: string | null;
  createdAt: string;
  direction?: 'sent' | 'received';
}

export interface SharedPromoAuditLogItem extends SharedPromoTransferInfo {
  id: string;
}

export interface LedgerTransaction {
  id: string;
  reference: string;
  clientEmail: string;
  clientName: string;
  type: 'package_purchase' | 'service_deduction' | 'refund' | 'promo_credit';
  creditsDelta: number;
  usdAmount: number;
  date: string;
  timestamp: number;
  paymentMethod: 'paypal' | 'credits' | 'promo' | 'manual';
  status: 'completed' | 'pending' | 'reversed';
  description?: string;
  bucket?: 'purchased' | 'promo';
  sharedPromo?: SharedPromoTransferInfo;
}

export interface LedgerCustomerSummary {
  clientEmail: string;
  clientName: string;
  userId?: string | null;
  walletBalance: number;
  walletPurchased: number;
  walletPromo: number;
  settledCreditsAllocated: number;
  pendingCreditsAllocated: number;
  settledCreditsUsed: number;
  pendingCreditsUsed: number;
  settledUsdVolume: number;
  pendingUsdVolume: number;
  projectCount: number;
  transactionCount: number;
}

interface AgencyDataGridProps {
  transactions: LedgerTransaction[];
  customers?: LedgerCustomerSummary[];
  sharedPromos?: SharedPromoAuditLogItem[];
  customerFilter?: string;
  onCustomerFilterChange?: (val: string) => void;
  typeFilter?: string;
  onTypeFilterChange?: (val: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (val: string) => void;
  className?: string;
}

type SortField = 'reference' | 'clientEmail' | 'type' | 'creditsDelta' | 'usdAmount' | 'timestamp';
type SortOrder = 'asc' | 'desc';

export function AgencyDataGrid({
  transactions,
  customers,
  sharedPromos = [],
  customerFilter: controlledCustomerFilter,
  onCustomerFilterChange,
  typeFilter: controlledTypeFilter,
  onTypeFilterChange,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
  className,
}: AgencyDataGridProps) {
  const router = useRouter();
  const topLoader = useTopLoader();

  const openClientWorkspace = useCallback(
    (email: string) => {
      if (!email) return;
      topLoader.start();
      router.push(`/management/clients?client=${encodeURIComponent(email.toLowerCase().trim())}`);
    },
    [router, topLoader]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [internalCustomerFilter, setInternalCustomerFilter] = useState<string>('all');
  const [internalTypeFilter, setInternalTypeFilter] = useState<string>('all');
  const [internalStatusFilter, setInternalStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const customerFilter = controlledCustomerFilter ?? internalCustomerFilter;
  const setCustomerFilter = (next: string | ((prev: string) => string)) => {
    const resolved = typeof next === 'function' ? next(customerFilter) : next;
    setInternalCustomerFilter(resolved);
    onCustomerFilterChange?.(resolved);
  };

  const typeFilter = controlledTypeFilter ?? internalTypeFilter;
  const setTypeFilter = (next: string) => {
    setInternalTypeFilter(next);
    onTypeFilterChange?.(next);
  };

  const statusFilter = controlledStatusFilter ?? internalStatusFilter;
  const setStatusFilter = (next: string) => {
    setInternalStatusFilter(next);
    onStatusFilterChange?.(next);
  };

  // Build or use provided customer summaries
  const resolvedCustomers = useMemo<LedgerCustomerSummary[]>(() => {
    if (customers && customers.length > 0) {
      return customers;
    }
    const map = new Map<string, LedgerCustomerSummary & { _refs: Set<string> }>();
    for (const t of transactions) {
      const emailKey = (t.clientEmail || 'client@humantek.com').toLowerCase().trim();
      let entry = map.get(emailKey);
      if (!entry) {
        entry = {
          clientEmail: emailKey,
          clientName: t.clientName || emailKey.split('@')[0],
          walletBalance: 0,
          walletPurchased: 0,
          walletPromo: 0,
          settledCreditsAllocated: 0,
          pendingCreditsAllocated: 0,
          settledCreditsUsed: 0,
          pendingCreditsUsed: 0,
          settledUsdVolume: 0,
          pendingUsdVolume: 0,
          projectCount: 0,
          transactionCount: 0,
          _refs: new Set<string>(),
        };
        map.set(emailKey, entry);
      }
      entry.transactionCount += 1;
      if (t.reference?.startsWith('HT-')) entry._refs.add(t.reference);
      if (t.status === 'completed') {
        if (t.creditsDelta > 0) entry.settledCreditsAllocated += t.creditsDelta;
        else if (t.creditsDelta < 0) entry.settledCreditsUsed += Math.abs(t.creditsDelta);
        entry.settledUsdVolume += t.usdAmount;
      } else if (t.status === 'pending') {
        if (t.creditsDelta > 0) entry.pendingCreditsAllocated += t.creditsDelta;
        else if (t.creditsDelta < 0) entry.pendingCreditsUsed += Math.abs(t.creditsDelta);
        entry.pendingUsdVolume += t.usdAmount;
      }
    }
    return Array.from(map.values())
      .map(({ _refs, ...c }) => {
        const net = Math.max(0, c.settledCreditsAllocated - c.settledCreditsUsed);
        return {
          ...c,
          walletBalance: net,
          walletPurchased: net,
          projectCount: _refs.size,
        };
      })
      .sort((a, b) => b.transactionCount - a.transactionCount || a.clientName.localeCompare(b.clientName));
  }, [customers, transactions]);

  const selectedCustomer = useMemo(() => {
    if (customerFilter === 'all') return null;
    return (
      resolvedCustomers.find((c) => c.clientEmail.toLowerCase().trim() === customerFilter) || null
    );
  }, [resolvedCustomers, customerFilter]);

  const customerComboboxOptions = useMemo(
    () =>
      resolvedCustomers.map((c) => ({
        clientEmail: c.clientEmail,
        clientName: c.clientName,
        count: c.transactionCount,
      })),
    [resolvedCustomers]
  );

  // Overall studio summary across all customers
  const studioSummary = useMemo(() => {
    return resolvedCustomers.reduce(
      (acc, c) => {
        acc.walletBalance += c.walletBalance;
        acc.walletPurchased += c.walletPurchased;
        acc.walletPromo += c.walletPromo;
        acc.settledCreditsAllocated += c.settledCreditsAllocated;
        acc.pendingCreditsAllocated += c.pendingCreditsAllocated;
        acc.settledCreditsUsed += c.settledCreditsUsed;
        acc.pendingCreditsUsed += c.pendingCreditsUsed;
        acc.settledUsdVolume += c.settledUsdVolume;
        acc.pendingUsdVolume += c.pendingUsdVolume;
        acc.projectCount += c.projectCount;
        return acc;
      },
      {
        walletBalance: 0,
        walletPurchased: 0,
        walletPromo: 0,
        settledCreditsAllocated: 0,
        pendingCreditsAllocated: 0,
        settledCreditsUsed: 0,
        pendingCreditsUsed: 0,
        settledUsdVolume: 0,
        pendingUsdVolume: 0,
        projectCount: 0,
      }
    );
  }, [resolvedCustomers]);

  // Sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'timestamp' || field === 'creditsDelta' || field === 'usdAmount' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const handleSelectCustomer = (email: string) => {
    const normalized = email.toLowerCase().trim();
    setCustomerFilter((prev) => (prev === normalized ? 'all' : normalized));
    setCurrentPage(1);
  };

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Customer Filter
      const matchesCustomer =
        customerFilter === 'all' ||
        t.clientEmail.toLowerCase().trim() === customerFilter ||
        t.sharedPromo?.senderEmail.toLowerCase().trim() === customerFilter ||
        t.sharedPromo?.recipientEmail.toLowerCase().trim() === customerFilter;

      // 2. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.reference.toLowerCase().includes(q) ||
        t.clientEmail.toLowerCase().includes(q) ||
        t.clientName.toLowerCase().includes(q) ||
        Boolean(t.description && t.description.toLowerCase().includes(q)) ||
        Boolean(t.sharedPromo?.senderName.toLowerCase().includes(q)) ||
        Boolean(t.sharedPromo?.senderEmail.toLowerCase().includes(q)) ||
        Boolean(t.sharedPromo?.recipientName.toLowerCase().includes(q)) ||
        Boolean(t.sharedPromo?.recipientEmail.toLowerCase().includes(q)) ||
        Boolean(t.sharedPromo?.code.toLowerCase().includes(q));

      // 3. Type Filter
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'shared_promo' ? Boolean(t.sharedPromo) : t.type === typeFilter);

      // 4. Status Filter
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      return matchesCustomer && matchesSearch && matchesType && matchesStatus;
    });
  }, [transactions, customerFilter, searchQuery, typeFilter, statusFilter]);

  // Filtered Shared Promo Audit Log (Friend-to-Friend Promo Transfers)
  const filteredSharedPromos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sharedPromos.filter((item) => {
      const matchesCustomer =
        customerFilter === 'all' ||
        item.senderEmail.toLowerCase().trim() === customerFilter ||
        item.recipientEmail.toLowerCase().trim() === customerFilter;

      const matchesSearch =
        !q ||
        item.code.toLowerCase().includes(q) ||
        item.senderName.toLowerCase().includes(q) ||
        item.senderEmail.toLowerCase().includes(q) ||
        item.recipientName.toLowerCase().includes(q) ||
        item.recipientEmail.toLowerCase().includes(q) ||
        Boolean(item.note && item.note.toLowerCase().includes(q));

      return matchesCustomer && matchesSearch;
    });
  }, [sharedPromos, customerFilter, searchQuery]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'timestamp') {
        comparison = a.timestamp - b.timestamp;
      } else if (sortField === 'creditsDelta') {
        comparison = a.creditsDelta - b.creditsDelta;
      } else if (sortField === 'usdAmount') {
        comparison = a.usdAmount - b.usdAmount;
      } else if (sortField === 'reference') {
        comparison = a.reference.localeCompare(b.reference);
      } else if (sortField === 'clientEmail') {
        comparison = a.clientEmail.localeCompare(b.clientEmail);
      } else if (sortField === 'type') {
        comparison = a.type.localeCompare(b.type);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredTransactions, sortField, sortOrder]);

  // Smart dynamic page-size tiers: only show tiers up to the first tier that fits all records
  const PAGE_SIZE_TIERS = [5, 10, 25, 50] as const;
  const maxNeededTier =
    PAGE_SIZE_TIERS.find((t) => t >= Math.max(sortedTransactions.length, 5)) ??
    PAGE_SIZE_TIERS[PAGE_SIZE_TIERS.length - 1];
  const availablePageSizes = PAGE_SIZE_TIERS.filter((t) => t <= maxNeededTier);
  const effectivePageSize = Math.min(pageSize, maxNeededTier);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / effectivePageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * effectivePageSize;
  const pageItems = sortedTransactions.slice(startIndex, startIndex + effectivePageSize);

  // Totals for filtered set
  const netCreditsDelta = filteredTransactions.reduce((acc, t) => acc + t.creditsDelta, 0);
  const totalUsdVolume = filteredTransactions.reduce((acc, t) => acc + t.usdAmount, 0);

  const isCustomerLocked = Boolean(controlledCustomerFilter && !onCustomerFilterChange);
  const hasActiveFilters =
    Boolean(searchQuery) ||
    (!isCustomerLocked && customerFilter !== 'all') ||
    typeFilter !== 'all' ||
    statusFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    if (!isCustomerLocked) {
      setCustomerFilter('all');
    }
    setTypeFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60 ml-1 inline" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-brand-text dark:text-amber-400 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-brand-text dark:text-amber-400 ml-1 inline" />
    );
  };

  const activeSummary = selectedCustomer || studioSummary;
  const totalAllocatedCredits =
    activeSummary.settledCreditsAllocated + activeSummary.pendingCreditsAllocated;
  const totalUsedCredits =
    activeSummary.settledCreditsUsed + activeSummary.pendingCreditsUsed;
  const totalUsd = activeSummary.settledUsdVolume + activeSummary.pendingUsdVolume;

  const fromIndex =
    sortedTransactions.length === 0 ? 0 : (activePage - 1) * effectivePageSize + 1;
  const toIndex = Math.min(activePage * effectivePageSize, sortedTransactions.length);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Credit Summary KPI Cards (Dynamically shows Overall Studio OR Selected Customer Details) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Available / Remaining Credits */}
        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>
              {selectedCustomer ? 'Customer Available Credits' : 'All Clients Available Credits'}
            </span>
            <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
              <Wallet className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <CreditValue value={activeSummary.walletBalance} size="lg" />
            <span className="text-2xs text-muted-foreground font-mono">
              {activeSummary.walletPromo > 0
                ? `${activeSummary.walletPurchased} pkg · ${activeSummary.walletPromo} promo`
                : 'net remaining'}
            </span>
          </div>
        </div>

        {/* Card 2: Total Credits Allocated (+CR) */}
        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>
              {selectedCustomer ? 'Customer Credits Purchased' : 'Total Credits Allocated'}
            </span>
            <span className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <CreditValue value={`+${totalAllocatedCredits}`} size="lg" variant="delta" />
            <span className="text-2xs text-muted-foreground font-mono">
              {activeSummary.settledCreditsAllocated} settled
              {activeSummary.pendingCreditsAllocated > 0
                ? ` · ${activeSummary.pendingCreditsAllocated} pending`
                : ''}
            </span>
          </div>
        </div>

        {/* Card 3: Credits Used in Scopes (-CR) */}
        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>
              {selectedCustomer ? 'Customer Credits Used' : 'Total Scope Deductions'}
            </span>
            <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
              <TrendingDown className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <CreditValue
              value={totalUsedCredits > 0 ? `-${totalUsedCredits}` : '0'}
              size="lg"
              variant="delta"
            />
            <span className="text-2xs text-muted-foreground font-mono">
              {activeSummary.settledCreditsUsed} settled
              {activeSummary.pendingCreditsUsed > 0
                ? ` · ${activeSummary.pendingCreditsUsed} pending`
                : ''}
            </span>
          </div>
        </div>

        {/* Card 4: USD Package Volume */}
        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>{selectedCustomer ? 'Customer USD Volume' : 'Total Package Volume'}</span>
            <span className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <span className="text-lg font-black font-mono tabular-nums text-foreground">
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-2xs text-muted-foreground font-mono">
              ${activeSummary.settledUsdVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} paid
              {activeSummary.pendingUsdVolume > 0
                ? ` · $${activeSummary.pendingUsdVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} pending`
                : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Friend-to-Friend Shared Promo Codes Audit Log (Shows Who Shared + Who Got Credits) */}
      {(filteredSharedPromos.length > 0 || typeFilter === 'shared_promo') && (
        <SharedPromoTransfersPanel
          items={filteredSharedPromos}
          onOpenClient={openClientWorkspace}
        />
      )}

      {/* Control Toolbar — matches AdminProjectsTable compact layout */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex flex-1 flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 min-w-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search reference, email, creator..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-8 text-xs bg-card rounded-lg border-border/80 focus-visible:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-center gap-2">
            {/* By Customer Searchable Combobox */}
            {(!controlledCustomerFilter || onCustomerFilterChange) && (
              <CustomerFilterCombobox
                customers={customerComboboxOptions}
                value={customerFilter}
                onValueChange={(val) => {
                  setCustomerFilter(val);
                  setCurrentPage(1);
                }}
                className="lg:w-[220px]"
              />
            )}

            {/* Type Filter */}
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter((val as string) || 'all');
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-card w-full lg:w-[165px] rounded-lg border-border/80">
                <SelectValue>
                  {typeFilter === 'package_purchase'
                    ? 'Package Purchase'
                    : typeFilter === 'service_deduction'
                      ? 'Service Scope'
                      : typeFilter === 'promo_credit'
                        ? 'Promo Code'
                        : typeFilter === 'shared_promo'
                          ? 'Shared Promo Codes'
                          : typeFilter === 'refund'
                            ? 'Refund'
                            : 'All Types'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Types</SelectItem>
                <SelectItem value="package_purchase" className="text-xs">Package Purchase</SelectItem>
                <SelectItem value="service_deduction" className="text-xs">Service Scope</SelectItem>
                <SelectItem value="promo_credit" className="text-xs">Promo Code</SelectItem>
                <SelectItem value="shared_promo" className="text-xs">Shared Promo Codes</SelectItem>
                <SelectItem value="refund" className="text-xs">Refund</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter((val as string) || 'all');
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-card w-full lg:w-[125px] rounded-lg border-border/80">
                <SelectValue>
                  {statusFilter === 'completed'
                    ? 'Settled'
                    : statusFilter === 'pending'
                      ? 'Pending'
                      : statusFilter === 'reversed'
                        ? 'Reversed'
                        : 'All Status'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                <SelectItem value="completed" className="text-xs">Settled</SelectItem>
                <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                <SelectItem value="reversed" className="text-xs">Reversed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Counts & Clear Filters — matches AdminProjectsTable */}
        <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            Showing <b className="text-foreground">{fromIndex}–{toIndex}</b> of{' '}
            <b className="text-foreground">{sortedTransactions.length}</b>
          </span>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Table View */}
      {sortedTransactions.length === 0 ? (
        <Empty className="p-10 border border-dashed rounded-xl bg-secondary/20">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-bold">No Credit Records Found</EmptyTitle>
            <EmptyDescription className="text-xs sm:text-sm">
              No transactions match your current filters. Try clearing filters.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-xs font-semibold rounded-lg"
            >
              Clear All Filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ResponsiveTableShell>
          {/* MOBILE VIEW (< md): Scannable Transaction Cards */}
          <MobileCardList>
            {pageItems.map((item) => (
              <LedgerMobileCard
                key={item.id}
                item={item}
                isSelectedCustomer={
                  customerFilter !== 'all' &&
                  item.clientEmail.toLowerCase().trim() === customerFilter
                }
                onSelectCustomer={handleSelectCustomer}
                onOpenClient={openClientWorkspace}
              />
            ))}

            {/* Mobile Filtered Totals Bar */}
            <div className="p-3.5 bg-muted/30 border-t border-border/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground">
                Totals (<span className="font-mono tabular-nums">{filteredTransactions.length}</span>)
              </span>
              <div className="flex items-center gap-3">
                <CreditValue
                  value={netCreditsDelta >= 0 ? `+${netCreditsDelta}` : `${netCreditsDelta}`}
                  size="xs"
                  variant="delta"
                />
                <span className="font-bold text-foreground font-mono tabular-nums">
                  ${totalUsdVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </MobileCardList>

          {/* DESKTOP VIEW (md+): Full Sortable Table */}
          <ResponsiveDesktopView>
            <Table className="min-w-[740px]">
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border/80 hover:bg-transparent select-none">
                  <TableHead
                    onClick={() => handleSort('reference')}
                    className="pl-5 font-bold text-xs text-foreground/80 h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Reference</span> {getSortIcon('reference')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('clientEmail')}
                    className="font-bold text-xs text-foreground/80 h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Client</span> {getSortIcon('clientEmail')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('type')}
                    className="font-bold text-xs text-foreground/80 h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Type</span> {getSortIcon('type')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('creditsDelta')}
                    className="font-bold text-xs text-foreground/80 text-right h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Credits Delta</span> {getSortIcon('creditsDelta')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('usdAmount')}
                    className="font-bold text-xs text-foreground/80 text-right h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>USD Amount</span> {getSortIcon('usdAmount')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('timestamp')}
                    className="pr-5 font-bold text-xs text-foreground/80 text-right h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Date &amp; Status</span> {getSortIcon('timestamp')}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageItems.map((item) => (
                  <LedgerTableRow
                    key={item.id}
                    item={item}
                    isSelectedCustomer={
                      customerFilter !== 'all' &&
                      item.clientEmail.toLowerCase().trim() === customerFilter
                    }
                    onSelectCustomer={handleSelectCustomer}
                    onOpenClient={openClientWorkspace}
                  />
                ))}
              </TableBody>

              <TableFooter>
                <TableRow className="hover:bg-transparent bg-muted/20">
                  <TableCell colSpan={3} className="pl-5 font-semibold text-xs text-foreground">
                    Filtered Totals (<span className="font-mono tabular-nums">{filteredTransactions.length}</span> records)
                  </TableCell>
                  <TableCell className="text-right font-bold text-xs text-foreground">
                    <CreditValue
                      value={netCreditsDelta >= 0 ? `+${netCreditsDelta}` : `${netCreditsDelta}`}
                      size="sm"
                      variant="delta"
                    />
                  </TableCell>
                  <TableCell className="text-right font-bold text-xs text-foreground font-mono tabular-nums">
                    ${totalUsdVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="pr-5" />
                </TableRow>
              </TableFooter>
            </Table>
          </ResponsiveDesktopView>

          {/* Clean Pagination Bar */}
          <TablePaginationBar
            page={activePage}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            pageSizeOptions={availablePageSizes}
            totalCount={sortedTransactions.length}
            fromIndex={fromIndex}
            toIndex={toIndex}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </ResponsiveTableShell>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared Promo Codes Audit Log Panel (Friend-to-Friend Promo Transfers)      */
/* -------------------------------------------------------------------------- */

const SharedPromoTransfersPanel = React.memo(function SharedPromoTransfersPanel({
  items,
  onOpenClient,
}: {
  items: SharedPromoAuditLogItem[];
  onOpenClient: (email: string) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-400/30 bg-card overflow-hidden shadow-2xs">
      <div className="px-4 py-3 bg-amber-400/10 border-b border-amber-400/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-7 rounded-lg bg-amber-400/20 text-brand-text dark:text-amber-300 flex items-center justify-center shrink-0">
            <Gift className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span>Shared Friend Promo Codes Log</span>
              <Badge variant="gold" size="xs" className="font-mono">
                {items.length}
              </Badge>
            </h3>
            <p className="text-2xs text-muted-foreground">
              Audit log showing the client who shared the promo code and the friend who received/claimed the credits.
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          No shared friend promo codes recorded yet.
        </div>
      ) : (
        <>
          {/* Mobile List */}
          <MobileCardList>
            {items.map((gift) => (
              <MobileDataCard key={gift.id} className="space-y-2.5">
                <MobileDataCardHeader>
                  <div className="font-mono font-bold text-brand-text dark:text-amber-400 text-xs">
                    {gift.code}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditValue value={gift.credits} size="xs" variant="pill" />
                    {gift.isClaimed ? (
                      <Badge variant="success" className="text-2xs px-2 py-0.5">
                        Claimed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-2xs px-2 py-0.5 text-amber-600 dark:text-amber-400 border-amber-400/30">
                        Pending Claim
                      </Badge>
                    )}
                  </div>
                </MobileDataCardHeader>

                <MobileDataCardBody className="flex-col items-stretch gap-2 text-xs">
                  <div className="grid grid-cols-1 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <div>
                      <span className="text-2xs uppercase tracking-wider font-bold text-muted-foreground block">
                        Shared By (Sender)
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenClient(gift.senderEmail)}
                        className="text-left group cursor-pointer mt-0.5"
                      >
                        <div className="font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400">
                          {gift.senderName}
                        </div>
                        <div className="text-2xs text-muted-foreground font-mono group-hover:underline">
                          {gift.senderEmail}
                        </div>
                      </button>
                    </div>
                    <div className="pt-1.5 border-t border-border/50">
                      <span className="text-2xs uppercase tracking-wider font-bold text-muted-foreground block">
                        Received By (Who Got Credits)
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenClient(gift.recipientEmail)}
                        className="text-left group cursor-pointer mt-0.5"
                      >
                        <div className="font-bold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400">
                          {gift.recipientName}
                        </div>
                        <div className="text-2xs text-muted-foreground font-mono group-hover:underline">
                          {gift.recipientEmail}
                        </div>
                      </button>
                    </div>
                  </div>
                </MobileDataCardBody>

                <MobileDataCardFooter className="text-2xs text-muted-foreground font-mono">
                  <span>Shared {formatStudioDate(gift.createdAt)}</span>
                  {gift.claimedAt && <span>Claimed {formatStudioDate(gift.claimedAt)}</span>}
                </MobileDataCardFooter>
              </MobileDataCard>
            ))}
          </MobileCardList>

          {/* Desktop Table */}
          <ResponsiveDesktopView>
            <Table className="min-w-[740px]">
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border/80 hover:bg-transparent select-none">
                  <TableHead className="pl-5 font-bold text-xs text-foreground/80 h-10">
                    Promo Code
                  </TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 h-10">
                    Shared By (Sender)
                  </TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 h-10">
                    Received By (Who Got Credits)
                  </TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 text-right h-10">
                    Credits
                  </TableHead>
                  <TableHead className="pr-5 font-bold text-xs text-foreground/80 text-right h-10">
                    Status &amp; Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((gift) => (
                  <TableRow
                    key={gift.id}
                    className="hover:bg-muted/40 transition-colors border-b border-border/60 last:border-b-0"
                  >
                    <TableCell className="pl-5 py-3 text-xs">
                      <div className="font-mono font-bold text-brand-text dark:text-amber-400">
                        {gift.code}
                      </div>
                      {gift.note && (
                        <div className="text-2xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                          Note: &ldquo;{gift.note}&rdquo;
                        </div>
                      )}
                    </TableCell>

                    {/* Sender */}
                    <TableCell className="py-3 text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenClient(gift.senderEmail)}
                        title={`Open ${gift.senderName}'s 360° Client Workspace`}
                        className="text-left group cursor-pointer"
                      >
                        <div className="font-semibold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400 flex items-center gap-1">
                          <span>{gift.senderName}</span>
                          <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-2xs text-muted-foreground font-mono group-hover:underline">
                          {gift.senderEmail}
                        </div>
                      </button>
                    </TableCell>

                    {/* Recipient */}
                    <TableCell className="py-3 text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenClient(gift.recipientEmail)}
                        title={`Open ${gift.recipientName}'s 360° Client Workspace`}
                        className="text-left group cursor-pointer"
                      >
                        <div className="font-semibold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400 flex items-center gap-1">
                          <span>{gift.recipientName}</span>
                          <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-2xs text-muted-foreground font-mono group-hover:underline">
                          {gift.recipientEmail}
                        </div>
                      </button>
                    </TableCell>

                    {/* Credits */}
                    <TableCell className="py-3 text-right">
                      <CreditValue value={gift.credits} size="xs" variant="pill" />
                    </TableCell>

                    {/* Status & Date */}
                    <TableCell className="pr-5 py-3 text-right text-xs">
                      <div className="inline-flex items-center gap-1.5">
                        {gift.isClaimed ? (
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Claimed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-2xs font-medium text-brand-text dark:text-amber-400">
                            <Clock className="size-3" />
                            Pending Claim
                          </span>
                        )}
                      </div>
                      <div className="text-2xs text-muted-foreground font-mono mt-0.5">
                        {gift.claimedAt
                          ? `Claimed ${formatStudioDate(gift.claimedAt)}`
                          : `Shared ${formatStudioDate(gift.createdAt)}`}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveDesktopView>
        </>
      )}
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*  Memoized Ledger Row & Mobile Card Subcomponents                            */
/* -------------------------------------------------------------------------- */

const LedgerTypeBadge = React.memo(function LedgerTypeBadge({
  type,
  sharedPromo,
}: {
  type: LedgerTransaction['type'];
  sharedPromo?: SharedPromoTransferInfo;
}) {
  if (sharedPromo) {
    return (
      <Badge variant="gold" className="text-2xs font-semibold px-2 py-0.5 gap-1">
        <Gift className="size-3" />
        <span>{sharedPromo.direction === 'sent' ? 'Promo Shared' : 'Friend Promo'}</span>
      </Badge>
    );
  }
  if (type === 'package_purchase') {
    return (
      <Badge variant="success" className="text-2xs font-semibold px-2 py-0.5">
        Package Purchase
      </Badge>
    );
  }
  if (type === 'service_deduction') {
    return (
      <Badge
        variant="outline"
        className="text-2xs font-semibold text-brand-text dark:text-amber-400 border-amber-400/30 px-2 py-0.5"
      >
        Service Scope
      </Badge>
    );
  }
  if (type === 'promo_credit') {
    return (
      <Badge variant="gold" className="text-2xs font-semibold px-2 py-0.5">
        Promo Code
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-2xs font-semibold px-2 py-0.5">
      Refund
    </Badge>
  );
});

const LedgerSettlementStatus = React.memo(function LedgerSettlementStatus({
  status,
}: {
  status: LedgerTransaction['status'];
}) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
        <CheckCircle2 className="size-3" /> Settled
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
    <span className="inline-flex items-center gap-1 text-brand-text dark:text-amber-400 font-medium">
      <Clock className="size-3" /> Pending
    </span>
  );
});

const LedgerMobileCard = React.memo(function LedgerMobileCard({
  item,
  isSelectedCustomer,
  onSelectCustomer,
  onOpenClient,
}: {
  item: LedgerTransaction;
  isSelectedCustomer: boolean;
  onSelectCustomer: (email: string) => void;
  onOpenClient: (email: string) => void;
}) {
  return (
    <MobileDataCard className="space-y-2.5">
      {/* Top Row: Reference & Type Badge */}
      <MobileDataCardHeader>
        <div className="min-w-0">
          <div className="font-mono font-bold text-brand-text dark:text-amber-400 text-xs truncate">
            {item.reference}
          </div>
          {item.description && (
            <div className="text-2xs text-muted-foreground truncate mt-0.5">
              {item.description}
            </div>
          )}
        </div>
        <LedgerTypeBadge type={item.type} sharedPromo={item.sharedPromo} />
      </MobileDataCardHeader>

      {/* Shared Promo Counterparty Pill (Shows both Who Shared and Who Got) */}
      {item.sharedPromo && (
        <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/25 text-2xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground font-medium">Shared by:</span>
            <button
              type="button"
              onClick={() => onOpenClient(item.sharedPromo!.senderEmail)}
              className="font-semibold text-foreground hover:text-brand-text dark:hover:text-amber-400 truncate cursor-pointer"
            >
              {item.sharedPromo.senderName} ({item.sharedPromo.senderEmail})
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground font-medium">Received by:</span>
            <button
              type="button"
              onClick={() => onOpenClient(item.sharedPromo!.recipientEmail)}
              className="font-semibold text-foreground hover:text-brand-text dark:hover:text-amber-400 truncate cursor-pointer"
            >
              {item.sharedPromo.recipientName} ({item.sharedPromo.recipientEmail})
            </button>
          </div>
        </div>
      )}

      {/* Middle Row: Client Identity & Settlement Status */}
      <MobileDataCardBody className="items-start text-xs">
        <button
          type="button"
          onClick={() => onSelectCustomer(item.clientEmail)}
          title={
            isSelectedCustomer
              ? 'Click to show all customers'
              : `Filter ledger by ${item.clientName || item.clientEmail}`
          }
          className="min-w-0 text-left group cursor-pointer"
        >
          <div
            className={cn(
              'font-semibold truncate transition-colors',
              isSelectedCustomer
                ? 'text-brand-text dark:text-amber-400'
                : 'text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400'
            )}
          >
            {item.clientName || 'Creator'}
          </div>
          <div className="text-muted-foreground text-2xs truncate group-hover:underline">
            {item.clientEmail}
          </div>
        </button>
        <div className="text-right shrink-0">
          <div className="font-medium text-foreground text-2xs font-mono tabular-nums">
            {item.date}
          </div>
          <div className="inline-flex items-center gap-1 text-2xs mt-0.5">
            <LedgerSettlementStatus status={item.status} />
          </div>
        </div>
      </MobileDataCardBody>

      {/* Bottom Row: Credits Delta & USD Amount */}
      <MobileDataCardFooter className="flex-row items-center pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted-foreground font-medium">Credits:</span>
          <CreditValue
            value={item.creditsDelta > 0 ? `+${item.creditsDelta}` : `${item.creditsDelta}`}
            size="xs"
            variant="delta"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted-foreground font-medium">Amount:</span>
          <span className="font-bold text-foreground text-xs font-mono tabular-nums">
            ${item.usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </MobileDataCardFooter>
    </MobileDataCard>
  );
});

const LedgerTableRow = React.memo(function LedgerTableRow({
  item,
  isSelectedCustomer,
  onSelectCustomer,
  onOpenClient,
}: {
  item: LedgerTransaction;
  isSelectedCustomer: boolean;
  onSelectCustomer: (email: string) => void;
  onOpenClient: (email: string) => void;
}) {
  return (
    <TableRow className="hover:bg-muted/40 transition-colors border-b border-border/60">
      {/* Reference & Shared Promo Details */}
      <TableCell className="pl-5 text-xs">
        <div className="font-mono font-bold text-brand-text dark:text-amber-400">
          {item.reference}
        </div>
        {item.sharedPromo ? (
          <div className="mt-1 space-y-0.5 text-2xs">
            <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
              <span className="font-semibold text-foreground/80">Shared by:</span>
              <button
                type="button"
                onClick={() => onOpenClient(item.sharedPromo!.senderEmail)}
                className="font-semibold text-foreground hover:text-brand-text dark:hover:text-amber-400 hover:underline cursor-pointer"
              >
                {item.sharedPromo.senderName} ({item.sharedPromo.senderEmail})
              </button>
            </div>
            <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
              <span className="font-semibold text-foreground/80">Received by:</span>
              <button
                type="button"
                onClick={() => onOpenClient(item.sharedPromo!.recipientEmail)}
                className="font-semibold text-foreground hover:text-brand-text dark:hover:text-amber-400 hover:underline cursor-pointer"
              >
                {item.sharedPromo.recipientName} ({item.sharedPromo.recipientEmail})
              </button>
            </div>
          </div>
        ) : (
          item.description && (
            <div className="text-2xs text-muted-foreground max-w-[260px] truncate mt-0.5" title={item.description}>
              {item.description}
            </div>
          )
        )}
      </TableCell>

      {/* Client (clickable to filter by customer) */}
      <TableCell className="text-xs">
        <button
          type="button"
          onClick={() => onSelectCustomer(item.clientEmail)}
          title={
            isSelectedCustomer
              ? 'Click to show all customers'
              : `Filter ledger by ${item.clientName || item.clientEmail}`
          }
          className="text-left group cursor-pointer"
        >
          <div
            className={cn(
              'font-semibold transition-colors',
              isSelectedCustomer
                ? 'text-brand-text dark:text-amber-400'
                : 'text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400'
            )}
          >
            {item.clientName || 'Creator'}
          </div>
          <div className="text-muted-foreground text-2xs group-hover:underline">
            {item.clientEmail}
          </div>
        </button>
      </TableCell>

      {/* Type Badge */}
      <TableCell>
        <LedgerTypeBadge type={item.type} sharedPromo={item.sharedPromo} />
      </TableCell>

      {/* Credits Delta */}
      <TableCell className="text-right text-xs">
        <CreditValue
          value={item.creditsDelta > 0 ? `+${item.creditsDelta}` : `${item.creditsDelta}`}
          size="sm"
          variant="delta"
        />
      </TableCell>

      {/* USD Amount */}
      <TableCell className="text-right font-bold text-foreground text-xs font-mono tabular-nums">
        ${item.usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </TableCell>

      {/* Date & Status */}
      <TableCell className="pr-5 text-right text-xs">
        <div className="font-medium text-foreground text-2xs font-mono tabular-nums">{item.date}</div>
        <div className="inline-flex items-center gap-1 text-2xs text-muted-foreground mt-0.5">
          <LedgerSettlementStatus status={item.status} />
        </div>
      </TableCell>
    </TableRow>
  );
});


