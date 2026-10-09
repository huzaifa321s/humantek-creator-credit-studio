'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* 1. Verified Revenue */}
      <Card className="p-3 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between min-h-[96px] h-auto">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            Verified Revenue
          </span>
          <div className="w-6 h-6 shrink-0 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="min-w-0 mt-1">
          {isLoading ? (
            <Skeleton className="h-6 w-24 rounded-md my-0.5" />
          ) : (
            <div className="text-lg sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight truncate">
              ${totalRevenue.toLocaleString()}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate">
            PayPal confirmed
          </span>
        </div>
      </Card>

      {/* 2. Committed Credits */}
      <Card className="p-3 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between min-h-[96px] h-auto">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            Committed
          </span>
          <div className="w-6 h-6 shrink-0 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground">
            <Coins className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="min-w-0 mt-1">
          {isLoading ? (
            <Skeleton className="h-6 w-24 rounded-md my-0.5" />
          ) : (
            <div className="text-lg sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight truncate">
              {totalCreditsAllocated.toLocaleString()} CR
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate">
            Active scope value
          </span>
        </div>
      </Card>

      {/* 3. Pending Review (highlighted in amber only if > 0 to signify pending work) */}
      <Card className="p-3 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between min-h-[96px] h-auto">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            Pending Review
          </span>
          <div
            className={cn(
              'w-6 h-6 shrink-0 rounded-md flex items-center justify-center',
              pendingReviewCount > 0
                ? 'bg-amber-400/15 text-brand-text dark:text-amber-400'
                : 'bg-secondary/80 text-muted-foreground'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="min-w-0 mt-1">
          {isLoading ? (
            <Skeleton className="h-6 w-12 rounded-md my-0.5" />
          ) : (
            <div
              className={cn(
                'text-lg sm:text-2xl font-black font-mono tabular-nums leading-tight truncate',
                pendingReviewCount > 0
                  ? 'text-brand-text dark:text-amber-400'
                  : 'text-foreground'
              )}
            >
              {pendingReviewCount}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate">
            Awaiting approval
          </span>
        </div>
      </Card>

      {/* 4. Active Production */}
      <Card className="p-3 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between min-h-[96px] h-auto">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            Active Orders
          </span>
          <div className="w-6 h-6 shrink-0 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground">
            <Layers className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="min-w-0 mt-1">
          {isLoading ? (
            <Skeleton className="h-6 w-12 rounded-md my-0.5" />
          ) : (
            <div className="text-lg sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight truncate">
              {activeOrdersCount}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate">
            In production
          </span>
        </div>
      </Card>
    </div>
  );
}
