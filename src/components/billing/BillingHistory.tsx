'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Search, RotateCcw, CreditCard, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { downloadProjectInvoice, preloadProjectInvoice } from '@/lib/invoice';
import { PAYMENT_PLATFORM_LABELS, type PaymentPlatform } from '@/lib/payment-platform';
import {
  PaymentPlatformIcon,
  PaymentPlatformLabel,
} from '@/components/ui/payment-platform-icon';
import { formatStudioDate } from '@/lib/utils';
import { useBillingInvoicesQuery, type BillingInvoice } from '@/lib/queries/billing';

type PlatformFilter = 'all' | PaymentPlatform;

const PLATFORM_ORDER: PaymentPlatform[] = ['paypal', 'bank_transfer', 'cashapp', 'wallet', 'none'];
const PAGE_SIZE_TIERS = [5, 10, 25, 50] as const;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  paid: 'success',
  unpaid: 'warning',
  pending: 'warning',
  refunded: 'destructive',
};

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Invoice list with per-row PDF download, responsive mobile cards, and reusable pagination.
 * `scope="all"` is the studio-wide view for Owner / Manager accounts and adds the client
 * column and payment-platform totals.
 */
export function BillingHistory({ scope }: { scope: 'mine' | 'all' }) {
  const isAdminView = scope === 'all';
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: invoices = [], isLoading, error } = useBillingInvoicesQuery(scope);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (platform !== 'all' && inv.paymentPlatform !== platform) return false;
      if (!q) return true;
      return [
        inv.projectCode,
        `inv-${inv.projectCode}`,
        inv.clientName,
        inv.email,
        inv.packageName,
        inv.paymentReference,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [invoices, platform, search]);

  const totals = useMemo(() => {
    const byPlatform = new Map<PaymentPlatform, { count: number; paidUsd: number }>();
    for (const inv of invoices) {
      const t = byPlatform.get(inv.paymentPlatform) ?? { count: 0, paidUsd: 0 };
      t.count += 1;
      if (inv.paymentStatus === 'paid') t.paidUsd += inv.packagePrice;
      byPlatform.set(inv.paymentPlatform, t);
    }
    return byPlatform;
  }, [invoices]);

  // Smart dynamic page-size tiers matching AgencyDataGrid, Wallet, and TeamAccess
  const maxNeededTier =
    PAGE_SIZE_TIERS.find((t) => t >= Math.max(filtered.length, 5)) ??
    PAGE_SIZE_TIERS[PAGE_SIZE_TIERS.length - 1];
  const availablePageSizes = PAGE_SIZE_TIERS.filter((t) => t <= maxNeededTier);
  const effectivePageSize = Math.min(pageSize, maxNeededTier);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * effectivePageSize;
  const fromIndex = totalCount === 0 ? 0 : startIndex + 1;
  const toIndex = Math.min(startIndex + effectivePageSize, totalCount);
  const pageInvoices = useMemo(
    () => filtered.slice(startIndex, startIndex + effectivePageSize),
    [filtered, startIndex, effectivePageSize]
  );

  const hasActiveFilters = Boolean(search.trim() || platform !== 'all');

  const resetFilters = () => {
    setPlatform('all');
    setSearch('');
    setCurrentPage(1);
  };

  const handleDownload = async (inv: BillingInvoice) => {
    if (downloadingId) return;
    setDownloadingId(inv.id);
    try {
      await downloadProjectInvoice(inv);
      toast.success(`Invoice INV-${inv.projectCode} downloaded`);
    } catch {
      toast.error('Could not generate invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const CORE_PLATFORMS: PaymentPlatform[] = ['paypal', 'bank_transfer', 'cashapp', 'wallet'];
  const tabs = [
    { value: 'all' as PlatformFilter, label: 'All', count: invoices.length },
    ...PLATFORM_ORDER.filter((p) => CORE_PLATFORMS.includes(p) || totals.has(p)).map((p) => ({
      value: p as PlatformFilter,
      label: PAYMENT_PLATFORM_LABELS[p],
      count: totals.get(p)?.count ?? 0,
    })),
  ];

  return (
    <div className="space-y-5" onMouseEnter={preloadProjectInvoice}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['paypal', 'bank_transfer', 'cashapp', 'wallet'] as PaymentPlatform[]).map((p) => {
          const t = totals.get(p);
          const isActiveCard = platform === p;
          return (
            <Card
              key={p}
              onClick={() => {
                setPlatform((prev) => (prev === p ? 'all' : p));
                setCurrentPage(1);
              }}
              className={`py-0 cursor-pointer transition-all select-none ${
                isActiveCard
                  ? 'border-amber-400 ring-1 ring-amber-400/50 bg-amber-400/[0.04]'
                  : 'hover:border-border'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    {PAYMENT_PLATFORM_LABELS[p]}
                  </p>
                  <PaymentPlatformIcon platform={p} size="sm" />
                </div>
                <p className="mt-1.5 text-xl font-extrabold font-mono tabular-nums">
                  {p === 'wallet' ? `${t?.count ?? 0} orders` : usd(t?.paidUsd ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p === 'wallet' ? 'Paid with credits' : `${t?.count ?? 0} orders, paid total`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter Tabs, Search Toolbar & Showing Counts */}
      {!isLoading && invoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <FilterTabs
              value={platform}
              onValueChange={(val) => {
                setPlatform(val as PlatformFilter);
                setCurrentPage(1);
              }}
              tabs={tabs}
              size="sm"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative w-full sm:w-64 lg:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={isAdminView ? 'Search invoice, client, reference...' : 'Search invoices...'}
                  className="pl-8 h-8 text-xs bg-card border-border/80 rounded-lg focus-visible:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  Showing <b className="text-foreground">{fromIndex}–{toIndex}</b> of{' '}
                  <b className="text-foreground">{totalCount}</b>
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
          </div>
        </div>
      )}

      {/* Main Content: Skeleton / Error / Empty / ResponsiveTableShell */}
      {isLoading ? (
        <ResponsiveTableShell>
          <MobileCardList>
            {[1, 2, 3].map((i) => (
              <MobileDataCard key={i}>
                <MobileDataCardHeader>
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-3 w-36 rounded-md" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </MobileDataCardHeader>
              </MobileDataCard>
            ))}
          </MobileCardList>
          <ResponsiveDesktopView className="p-4 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </ResponsiveDesktopView>
        </ResponsiveTableShell>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive border-destructive/30 bg-destructive/5">
          {(error as Error).message || 'Failed to load billing history'}
        </Card>
      ) : invoices.length === 0 ? (
        <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-12 sm:p-14 shadow-xs">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCard className="size-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="text-xl font-bold text-foreground">
              No invoices yet
            </EmptyTitle>
            <EmptyDescription className="text-muted-foreground text-sm">
              {isAdminView
                ? 'Client project invoices and payment records will appear here as orders are placed.'
                : 'Start a project to view your official studio invoices and download PDF receipts.'}
            </EmptyDescription>
          </EmptyHeader>
          {!isAdminView && (
            <EmptyContent>
              <Button
                variant="default"
                className="text-sm font-bold h-10 px-5 gap-2 bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground cursor-pointer shadow-xs shadow-amber-400/20"
                render={<Link href="/new-project" />}
                nativeButton={false}
              >
                <Plus className="size-4" />
                Start a project
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty className="p-10 border border-dashed rounded-xl bg-secondary/20">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-lg">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-bold">No Matching Invoices</EmptyTitle>
            <EmptyDescription className="text-xs sm:text-sm">
              No invoices match your current filter or search query.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-xs font-semibold rounded-lg cursor-pointer"
            >
              Reset Filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ResponsiveTableShell>
          {/* MOBILE VIEW (< md): Scannable Invoice Data Cards */}
          <MobileCardList>
            {pageInvoices.map((inv) => (
              <MobileDataCard key={inv.id} className="space-y-2.5">
                <MobileDataCardHeader>
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-brand-text dark:text-amber-400 text-xs truncate">
                      INV-{inv.projectCode}
                    </div>
                    <div className="text-2xs text-muted-foreground truncate mt-0.5">
                      {inv.packageName} · {formatStudioDate(inv.createdAt)}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[inv.paymentStatus] ?? 'secondary'} className="capitalize shrink-0">
                    {inv.paymentStatus}
                  </Badge>
                </MobileDataCardHeader>

                <MobileDataCardBody className="items-start text-xs">
                  <div className="min-w-0">
                    {isAdminView ? (
                      <>
                        <div className="font-semibold text-foreground truncate">
                          {inv.clientName || 'Creator'}
                        </div>
                        <div className="text-2xs text-muted-foreground truncate">{inv.email}</div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                        <span>Paid via</span>
                        <PaymentPlatformLabel
                          platform={inv.paymentPlatform}
                          size="xs"
                          labelClassName="text-xs font-semibold text-foreground"
                        />
                      </div>
                    )}
                    {isAdminView && (
                      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground mt-1 flex-wrap">
                        <PaymentPlatformLabel
                          platform={inv.paymentPlatform}
                          size="xs"
                          labelClassName="text-2xs font-semibold text-foreground"
                        />
                        {inv.paymentReference ? (
                          <span className="font-mono select-all">· {inv.paymentReference}</span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {inv.paymentPlatform === 'wallet' && inv.packagePrice === 0 ? (
                      <CreditValue value={inv.usedCredits} size="xs" variant="pill" />
                    ) : (
                      <span className="font-mono font-bold text-foreground text-xs tabular-nums">
                        {usd(inv.packagePrice)}
                      </span>
                    )}
                  </div>
                </MobileDataCardBody>

                <MobileDataCardFooter className="pt-2">
                  <span className="text-2xs text-muted-foreground font-mono">
                    {inv.projectCode}
                  </span>
                  <MobileDataCardActions>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
                      disabled={downloadingId === inv.id}
                      onClick={() => handleDownload(inv)}
                    >
                      <Download className="size-3.5 text-brand-text dark:text-amber-400" />
                      <span>{downloadingId === inv.id ? 'Preparing...' : 'Download PDF'}</span>
                    </Button>
                  </MobileDataCardActions>
                </MobileDataCardFooter>
              </MobileDataCard>
            ))}
          </MobileCardList>

          {/* DESKTOP VIEW (md+): Full Studio Table */}
          <ResponsiveDesktopView>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border/80 hover:bg-transparent select-none">
                  <TableHead className="pl-5 font-bold text-xs text-foreground/80 h-11">Invoice</TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 h-11">Date</TableHead>
                  {isAdminView && (
                    <TableHead className="font-bold text-xs text-foreground/80 h-11">Client</TableHead>
                  )}
                  <TableHead className="font-bold text-xs text-foreground/80 h-11">Package</TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 text-right h-11">Amount</TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 h-11">Paid via</TableHead>
                  <TableHead className="font-bold text-xs text-foreground/80 h-11">Status</TableHead>
                  <TableHead className="pr-5 font-bold text-xs text-foreground/80 text-right h-11">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageInvoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/40 transition-colors border-b border-border/60">
                    <TableCell className="pl-5 font-mono text-xs font-bold text-brand-text dark:text-amber-400 whitespace-nowrap">
                      INV-{inv.projectCode}
                    </TableCell>
                    <TableCell className="text-xs font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatStudioDate(inv.createdAt)}
                    </TableCell>
                    {isAdminView && (
                      <TableCell className="text-xs">
                        <div className="font-semibold text-foreground">{inv.clientName || '-'}</div>
                        <div className="text-2xs text-muted-foreground">{inv.email}</div>
                      </TableCell>
                    )}
                    <TableCell className="text-xs font-medium text-foreground">{inv.packageName}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold tabular-nums whitespace-nowrap">
                      {inv.paymentPlatform === 'wallet' && inv.packagePrice === 0 ? (
                        <CreditValue value={inv.usedCredits} size="xs" />
                      ) : (
                        usd(inv.packagePrice)
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <PaymentPlatformLabel
                        platform={inv.paymentPlatform}
                        size="sm"
                        className="whitespace-nowrap"
                      />
                      {isAdminView && inv.paymentReference && (
                        <div className="font-mono text-2xs text-muted-foreground select-all mt-0.5 pl-7">
                          {inv.paymentReference}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.paymentStatus] ?? 'secondary'} className="capitalize">
                        {inv.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
                        disabled={downloadingId === inv.id}
                        onClick={() => handleDownload(inv)}
                      >
                        <Download className="size-3.5 text-brand-text dark:text-amber-400" />
                        {downloadingId === inv.id ? 'Preparing...' : 'PDF'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveDesktopView>

          {/* Reusable TablePaginationBar */}
          <TablePaginationBar
            page={activePage}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            pageSizeOptions={availablePageSizes}
            totalCount={totalCount}
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
