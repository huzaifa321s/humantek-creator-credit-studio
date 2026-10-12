'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import { DollarSign, Coins, Clock, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminKpiStripProps {
  totalRevenue: number;
  totalCreditsAllocated: number;
  pendingReviewCount: number;
  activeOrdersCount: number;
  isLoading?: boolean;
}

export function AdminKpiStrip({
  totalRevenue,
  totalCreditsAllocated,
  pendingReviewCount,
  activeOrdersCount,
  isLoading = false,
}: AdminKpiStripProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Verified Revenue */}
      <Card className="p-4 sm:p-4.5 rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-400/30 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            Verified Revenue
          </span>
          <div className="size-6 shrink-0 rounded-md bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
            <DollarSign className="size-3.5" />
          </div>
        </div>

        <div className="min-w-0 mt-2">
          {isLoading ? (
            <Skeleton className="h-7 w-24 rounded-md my-0.5" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight truncate">
              ${totalRevenue.toLocaleString()}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate mt-0.5">
            Confirmed payments
          </span>
        </div>
      </Card>

      {/* 2. Committed Credits */}
      <Card className="p-4 sm:p-4.5 rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-400/30 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            Committed Credits
          </span>
          <div className="size-6 shrink-0 rounded-md bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
            <Coins className="size-3.5" />
          </div>
        </div>

        <div className="min-w-0 mt-2">
          {isLoading ? (
            <Skeleton className="h-7 w-24 rounded-md my-0.5" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight truncate">
              <CreditValue value={totalCreditsAllocated} size="md" />
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate mt-0.5">
            Active project value
          </span>
        </div>
      </Card>

      {/* 3. Pending Review */}
      <Card className="p-4 sm:p-4.5 rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-400/30 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            Pending Review
          </span>
          <div
            className={cn(
              'size-6 shrink-0 rounded-md flex items-center justify-center transition-colors',
              pendingReviewCount > 0
                ? 'bg-amber-400/20 text-brand-text dark:text-amber-300 font-bold'
                : 'bg-secondary/80 text-muted-foreground'
            )}
          >
            <Clock className="size-3.5" />
          </div>
        </div>

        <div className="min-w-0 mt-2">
          {isLoading ? (
            <Skeleton className="h-7 w-12 rounded-md my-0.5" />
          ) : (
            <div
              className={cn(
                'text-xl sm:text-2xl font-black font-mono tabular-nums leading-tight truncate',
                pendingReviewCount > 0
                  ? 'text-brand-text dark:text-amber-400'
                  : 'text-foreground'
              )}
            >
              {pendingReviewCount}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate mt-0.5">
            Briefs awaiting scoping
          </span>
        </div>
      </Card>

      {/* 4. Active Orders */}
      <Card className="p-4 sm:p-4.5 rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-400/30 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            Active Projects
          </span>
          <div className="size-6 shrink-0 rounded-md bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center">
            <Layers className="size-3.5" />
          </div>
        </div>

        <div className="min-w-0 mt-2">
          {isLoading ? (
            <Skeleton className="h-7 w-12 rounded-md my-0.5" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight truncate">
              {activeOrdersCount}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate mt-0.5">
            In active production
          </span>
        </div>
      </Card>
    </div>
  );
}
