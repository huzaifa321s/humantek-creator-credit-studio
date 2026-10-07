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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Verified Revenue */}
      <Card className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between h-[96px]">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            Verified Revenue
          </span>
          <div className="w-6 h-6 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          {isLoading ? (
            <Skeleton className="h-6 w-24 rounded-md my-0.5" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight">
              ${totalRevenue.toLocaleString()}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate">
            PayPal confirmed orders
          </span>
        </div>
      </Card>

      {/* 2. Committed Credits */}
      <Card className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between h-[96px]">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            Committed Credits
          </span>
          <div className="w-6 h-6 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground">
            <Coins className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          {isLoading ? (
            <Skeleton className="h-6 w-24 rounded-md my-0.5" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight">
              {totalCreditsAllocated.toLocaleString()} CR
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate">
            Active work scope value
          </span>
        </div>
      </Card>

      {/* 3. Pending Review (highlighted in amber only if > 0 to signify pending work) */}
      <Card className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between h-[96px]">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            Pending Review
          </span>
          <div
            className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center',
              pendingReviewCount > 0
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-secondary/80 text-muted-foreground'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          {isLoading ? (
            <Skeleton className="h-6 w-12 rounded-md my-0.5" />
          ) : (
            <div
              className={cn(
                'text-xl sm:text-2xl font-black font-mono tabular-nums leading-tight',
                pendingReviewCount > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-foreground'
              )}
            >
              {pendingReviewCount}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate">
            Awaiting studio approval
          </span>
        </div>
      </Card>

      {/* 4. Active Production */}
      <Card className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between h-[96px]">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            Active Production
          </span>
          <div className="w-6 h-6 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground">
            <Layers className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          {isLoading ? (
            <Skeleton className="h-6 w-12 rounded-md my-0.5" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-foreground font-mono tabular-nums leading-tight">
              {activeOrdersCount}
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium block truncate">
            In review or production
          </span>
        </div>
      </Card>
    </div>
  );
}
