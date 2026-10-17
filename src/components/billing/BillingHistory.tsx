'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { downloadProjectInvoice, preloadProjectInvoice } from '@/lib/invoice';
import { PAYMENT_PLATFORM_LABELS, type PaymentPlatform } from '@/lib/payment-platform';
import { formatStudioDate } from '@/lib/utils';
import type { serializeAdminProject } from '@/lib/serializers/project';

type BillingInvoice = ReturnType<typeof serializeAdminProject> & {
  paymentPlatform: PaymentPlatform;
  paymentReference: string | null;
};

type PlatformFilter = 'all' | PaymentPlatform;

const PLATFORM_ORDER: PaymentPlatform[] = ['paypal', 'bank_transfer', 'cashapp', 'wallet', 'none'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  unpaid: 'secondary',
  pending: 'secondary',
  refunded: 'destructive',
};

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function fetchInvoices(scope: 'mine' | 'all'): Promise<BillingInvoice[]> {
  const res = await fetch(scope === 'all' ? '/api/billing?scope=all' : '/api/billing');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data.invoices as BillingInvoice[];
}

/**
 * Invoice list with per-row PDF download. `scope="all"` is the studio-wide view for
 * Owner / Manager accounts and adds the client column and payment-platform totals.
 */
export function BillingHistory({ scope }: { scope: 'mine' | 'all' }) {
  const isAdminView = scope === 'all';
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['billing', scope],
    queryFn: () => fetchInvoices(scope),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (platform !== 'all' && inv.paymentPlatform !== platform) return false;
      if (!q) return true;
      return [inv.projectCode, inv.clientName, inv.email, inv.packageName, inv.paymentReference]
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

  const tabs = [
    { value: 'all' as PlatformFilter, label: 'All', count: invoices.length },
    ...PLATFORM_ORDER.filter((p) => totals.has(p)).map((p) => ({
      value: p as PlatformFilter,
      label: PAYMENT_PLATFORM_LABELS[p],
      count: totals.get(p)?.count ?? 0,
    })),
  ];

  return (
    <div className="space-y-5" onMouseEnter={preloadProjectInvoice}>
      {isAdminView && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(['paypal', 'bank_transfer', 'cashapp', 'wallet'] as PaymentPlatform[]).map((p) => {
            const t = totals.get(p);
            return (
              <Card key={p} className="py-0">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {PAYMENT_PLATFORM_LABELS[p]}
                  </p>
                  <p className="mt-1 text-xl font-extrabold font-mono tabular-nums">
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
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <FilterTabs value={platform} onValueChange={setPlatform} tabs={tabs} size="sm" />
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAdminView ? 'Search invoice, client, reference...' : 'Search invoices...'}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <Card className="py-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{(error as Error).message}</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No invoices found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  {isAdminView && <TableHead>Client</TableHead>}
                  <TableHead>Package</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Paid via</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">
                      INV-{inv.projectCode}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatStudioDate(inv.createdAt)}</TableCell>
                    {isAdminView && (
                      <TableCell className="text-xs">
                        <div className="font-semibold">{inv.clientName || '-'}</div>
                        <div className="text-muted-foreground">{inv.email}</div>
                      </TableCell>
                    )}
                    <TableCell className="text-xs">{inv.packageName}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums whitespace-nowrap">
                      {inv.paymentPlatform === 'wallet' ? `${inv.usedCredits} CR` : usd(inv.packagePrice)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold whitespace-nowrap">
                        {PAYMENT_PLATFORM_LABELS[inv.paymentPlatform]}
                      </div>
                      {isAdminView && inv.paymentReference && (
                        <div className="font-mono text-muted-foreground select-all">{inv.paymentReference}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.paymentStatus] ?? 'secondary'} className="capitalize">
                        {inv.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={downloadingId === inv.id}
                        onClick={() => handleDownload(inv)}
                      >
                        <Download className="size-3.5" />
                        {downloadingId === inv.id ? 'Preparing...' : 'PDF'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
