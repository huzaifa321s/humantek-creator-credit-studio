'use client';

import React, { Suspense, useState } from 'react';
import { AgencyDataGrid } from '@/components/AgencyDataGrid';
import { useManagementLedgerQuery } from '@/lib/queries/management';
import { Skeleton } from '@/components/ui/skeleton';

/* ============================================================================
 * FUTURE USE: Imports for Manual Credit Issuing System
 * ============================================================================
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/lib/userStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Coins, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
============================================================================ */

function InnerLedgerContent() {
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  /* ============================================================================
   * FUTURE USE: Manual Credit Issuing System (Commented out for future activation)
   * ============================================================================
  const queryClient = useQueryClient();
  const canIssueCredits = useUserStore((s) => s.canIssueCredits());

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueEmail, setIssueEmail] = useState('');
  const [issueDelta, setIssueDelta] = useState('5');
  const [issueBucket, setIssueBucket] = useState<'promo' | 'purchased'>('promo');
  const [issueDesc, setIssueDesc] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);

  const handleOpenIssueModal = () => {
    if (customerFilter !== 'all') {
      setIssueEmail(customerFilter);
    }
    setIsIssueModalOpen(true);
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deltaNum = parseInt(issueDelta, 10);
    if (!issueEmail.trim() || isNaN(deltaNum) || deltaNum === 0) {
      toast.error('Please enter a valid client email and credit amount.');
      return;
    }

    setIsIssuing(true);
    try {
      const res = await fetch('/api/management/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: issueEmail.trim().toLowerCase(),
          delta: deltaNum,
          bucket: issueBucket,
          description: issueDesc.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Could not issue credits.');
        return;
      }

      toast.success(
        `${deltaNum > 0 ? `+${deltaNum}` : deltaNum} CR applied to ${json.clientEmail || issueEmail}.`
      );
      setIsIssueModalOpen(false);
      setIssueDesc('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['management', 'ledger'] }),
        queryClient.invalidateQueries({ queryKey: ['management', 'summary'] }),
      ]);
    } catch {
      toast.error('Failed to issue credits.');
    } finally {
      setIsIssuing(false);
    }
  };
  ============================================================================ */

  const { data, isPending } = useManagementLedgerQuery({
    limit: 500,
    customer: customerFilter,
    type: typeFilter,
    status: statusFilter,
  });
  const transactions = data?.transactions || [];
  const customers = data?.customers || [];

  if (isPending && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ============================================================================
        * FUTURE USE: Manual Credit Issuing Header Bar & Trigger Button
        * ============================================================================
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {canIssueCredits
            ? 'Select a customer below or issue manual studio credits to any registered client.'
            : 'Read-only Viewer access — credit issuance requires Manager or Owner role.'}
        </div>
        {canIssueCredits && (
          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={handleOpenIssueModal}
            className="h-8 px-3 text-xs font-bold gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
          >
            <Plus className="size-3.5" />
            <span>Issue Credits</span>
          </Button>
        )}
      </div>
      ============================================================================ */}

      <AgencyDataGrid
        transactions={transactions}
        customers={customers}
        customerFilter={customerFilter}
        onCustomerFilterChange={setCustomerFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* ============================================================================
        * FUTURE USE: Manual Credit Issuing Modal (Dialog)
        * ============================================================================
      <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Coins className="size-4 text-brand-text dark:text-amber-400" />
              <span>Issue Studio Credits</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Grant promotional or purchased credits directly to a client’s Studio Wallet.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleIssueSubmit} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block">
                Client Email
              </label>
              <Input
                type="email"
                required
                placeholder="creator@example.com"
                value={issueEmail}
                onChange={(e) => setIssueEmail(e.target.value)}
                list="ledger-known-clients"
                className="h-9 text-xs bg-background rounded-lg border-border/80"
              />
              <datalist id="ledger-known-clients">
                {customers.map((c) => (
                  <option key={c.clientEmail} value={c.clientEmail}>
                    {c.clientName}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Credits Amount (CR)
                </label>
                <Input
                  type="number"
                  required
                  value={issueDelta}
                  onChange={(e) => setIssueDelta(e.target.value)}
                  className="h-9 text-xs font-mono bg-background rounded-lg border-border/80"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Wallet Bucket
                </label>
                <Select
                  value={issueBucket}
                  onValueChange={(val) => {
                    if (val === 'promo' || val === 'purchased') {
                      setIssueBucket(val);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background rounded-lg border-border/80 w-full">
                    <SelectValue>
                      {issueBucket === 'promo' ? 'Promo Credits' : 'Purchased Credits'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promo" className="text-xs">
                      Promo Credits
                    </SelectItem>
                    <SelectItem value="purchased" className="text-xs">
                      Purchased Credits
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block">
                Reason / Note (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Loyalty bonus or scope adjustment"
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
                className="h-9 text-xs bg-background rounded-lg border-border/80"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsIssueModalOpen(false)}
                className="h-9 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gold"
                size="sm"
                disabled={isIssuing}
                className="h-9 text-xs font-bold gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
              >
                {isIssuing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Issuing...</span>
                  </>
                ) : (
                  <>
                    <Coins className="size-3.5" />
                    <span>Confirm Credits</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      ============================================================================ */}
    </div>
  );
}

export function LedgerPageContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <InnerLedgerContent />
    </Suspense>
  );
}

