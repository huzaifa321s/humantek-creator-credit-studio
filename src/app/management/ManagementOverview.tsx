'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FolderKanban,
  MessageSquare,
  Receipt,
  Landmark,
  ShieldAlert,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AdminKpiStrip } from '@/components/management/AdminKpiStrip';
import { useManagementSummaryQuery } from '@/lib/queries/management';
import { useProjectsQuery } from '@/lib/queries/projects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import { getProjectStatusLabel, formatStudioDate } from '@/lib/utils';

export function ManagementOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Backwards compatibility redirect for legacy bookmarks / links with ?tab=
  useEffect(() => {
    if (tabParam === 'projects') {
      router.replace('/management/projects');
    } else if (tabParam === 'messages') {
      router.replace('/management/inbox');
    } else if (tabParam === 'wire-orders') {
      router.replace('/management/orders');
    } else if (tabParam === 'alerts') {
      router.replace('/management/alerts');
    } else if (tabParam === 'ledger') {
      router.replace('/management/ledger');
    }
  }, [tabParam, router]);

  const { data: summary, isPending: isSummaryLoading } = useManagementSummaryQuery();
  const { data: recentProjects = [], isPending: isProjectsLoading } = useProjectsQuery();

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
    alerts: 0,
    ledger: 0,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Authoritative Server-Computed KPI Strip */}
      {isSummaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <AdminKpiStrip
          totalRevenue={kpis.totalRevenue}
          activeOrdersCount={kpis.activeOrdersCount}
          pendingReviewCount={kpis.pendingReviewCount}
          totalCreditsAllocated={kpis.totalCreditsAllocated}
        />
      )}

      {/* 2. Action Centers: Requires Attention */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Action Centers &bull; Attention Needed
          </h2>
          <span className="text-xs text-muted-foreground font-mono">Live Pulse</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Pending Projects Review */}
          <div className="rounded-xl border border-border/80 bg-card/60 p-4 flex flex-col justify-between hover:border-amber-400/40 transition-all shadow-xs group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-amber-400/10 text-amber-500">
                  <Clock className="size-4" />
                </span>
                <Badge
                  variant="outline"
                  className={
                    counts.pendingReview > 0
                      ? 'border-amber-400/30 text-amber-500 font-bold bg-amber-400/10'
                      : 'text-muted-foreground'
                  }
                >
                  {counts.pendingReview} Pending
                </Badge>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Project Scope Reviews</h3>
              <p className="text-xs text-muted-foreground">
                New briefs submitted by clients awaiting review, milestone scoping, or delivery sign-off.
              </p>
            </div>
            <div className="pt-4">
              <Link href="/management/projects?status=pending_review">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs font-semibold justify-between group-hover:bg-amber-400/15 group-hover:text-brand-text dark:group-hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <span>Review Queue</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 2: Wire Orders Verification */}
          <div className="rounded-xl border border-border/80 bg-card/60 p-4 flex flex-col justify-between hover:border-blue-400/40 transition-all shadow-xs group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Landmark className="size-4" />
                </span>
                <Badge
                  variant="outline"
                  className={
                    counts.wireOrders > 0
                      ? 'border-blue-400/30 text-blue-500 font-bold bg-blue-400/10'
                      : 'text-muted-foreground'
                  }
                >
                  {counts.wireOrders} Awaiting Bank
                </Badge>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Wire & Manual Orders</h3>
              <p className="text-xs text-muted-foreground">
                Client wire transfers, Payoneer receipts, and manual payment confirmations needing verification.
              </p>
            </div>
            <div className="pt-4">
              <Link href="/management/orders">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs font-semibold justify-between group-hover:bg-blue-500/15 group-hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <span>Verify Receipts</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 3: Security & Settlement Alerts */}
          <div className="rounded-xl border border-border/80 bg-card/60 p-4 flex flex-col justify-between hover:border-rose-400/40 transition-all shadow-xs group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                  <ShieldAlert className="size-4" />
                </span>
                <Badge
                  variant="outline"
                  className={
                    counts.alerts > 0
                      ? 'border-rose-400/30 text-rose-500 font-bold bg-rose-400/10'
                      : 'text-muted-foreground'
                  }
                >
                  {counts.alerts} Unresolved
                </Badge>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Security & Settlements</h3>
              <p className="text-xs text-muted-foreground">
                Payment shortfalls, chargeback alerts, credit clawbacks, or payment disputes.
              </p>
            </div>
            <div className="pt-4">
              <Link href="/management/alerts">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs font-semibold justify-between group-hover:bg-rose-500/15 group-hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <span>Investigate Alerts</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recent Projects Snapshot */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="size-4 text-amber-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Recent Agency Projects
            </h2>
          </div>
          <Link
            href="/management/projects"
            className="text-xs font-semibold text-amber-500 hover:text-amber-400 inline-flex items-center gap-1 transition-colors"
          >
            <span>View Full Queue ({counts.projects})</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
          {isProjectsLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No projects recorded in database yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentProjects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {project.projectCode || project.id.slice(0, 8)}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-2xs font-semibold capitalize"
                      >
                        {getProjectStatusLabel(project.status)}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          project.paymentStatus === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-2xs'
                            : 'text-2xs'
                        }
                      >
                        {project.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Client: <span className="text-foreground font-medium">{project.clientName}</span> ({project.email}) &bull; Package: {project.packageName}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-foreground">
                        ${project.packagePrice.toLocaleString()} USD
                      </div>
                      <div className="text-2xs text-muted-foreground font-mono">
                        {project.usedCredits} Credits
                      </div>
                    </div>
                    <Link href={`/management/projects?project=${project.id}`}>
                      <Button size="sm" variant="outline" className="h-8 text-xs font-semibold cursor-pointer">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
