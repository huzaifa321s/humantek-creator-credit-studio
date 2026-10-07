'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ProjectRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconTile } from '@/components/reui/icon-tile';
import { AgencyDataGrid, type LedgerTransaction } from '@/components/AgencyDataGrid';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditValue } from '@/components/ui/credit-value';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Coins,
  Filter,
  DollarSign,
  Clock,
  CheckCircle,
  MessageSquare,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import { ChatFullView } from '@/components/chat/ChatFullView';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectsQuery, useUpdateProjectStatus } from '@/lib/queries/projects';
import { useStudioChat } from '@/lib/chatStore';

const EMPTY_PROJECTS: ProjectRecord[] = [];

export default function ManagementPage() {
  const { setActiveProjectId } = useStudioChat();
  const [activeTab, setActiveTab] = useState<'projects' | 'ledger' | 'messages'>('projects');
  const [statusFilter, setStatusFilter] = useState('all');

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const isLoading = projectsQuery.isPending;
  const updateStatus = useUpdateProjectStatus();
  const isUpdating = updateStatus.isPending ? updateStatus.variables?.id ?? null : null;

  const handleUpdateStatus = (
    id: string,
    newStatus: ProjectRecord['status'],
    newPayment?: ProjectRecord['paymentStatus']
  ) => {
    updateStatus.mutate(
      { id, status: newStatus, paymentStatus: newPayment },
      {
        onSuccess: () => toast.success(`Updated project status to ${newStatus.replace('_', ' ')}`),
        onError: (err) => toast.error(err.message || 'Failed to update status'),
      }
    );
  };

  const totalRevenue = projects
    .filter((p) => p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + p.packagePrice, 0);

  const totalCreditsAllocated = projects.reduce((sum, p) => sum + p.usedCredits, 0);
  const activeOrdersCount = projects.filter(
    (p) => p.status !== 'delivered' && p.status !== 'declined'
  ).length;
  const deliveredCount = projects.filter((p) => p.status === 'delivered').length;

  const filteredProjects = projects.filter(
    (p) => statusFilter === 'all' || p.status === statusFilter
  );

  const ledgerTransactions: LedgerTransaction[] = useMemo(() => {
    const list: LedgerTransaction[] = [];

    // For every real project, generate audit transactions matching its funding model
    projects.forEach((p) => {
      if (p.id === 'proj-demo-1') return; // Handled by seed-tx-1 / seed-tx-2

      const isWalletFunding = p.fundingSource === 'wallet' || p.packageId === 'studio-wallet' || p.paymentMethod === 'credits';

      // Only package purchases have a PayPal deposit transaction
      if (!isWalletFunding) {
        list.push({
          id: `tx-purchase-${p.id}`,
          reference: p.projectCode || `HT-${p.id.slice(-6).toUpperCase()}`,
          clientEmail: p.email,
          clientName: p.clientName,
          type: 'package_purchase',
          creditsDelta: p.packageCredits || (p.usedCredits + (p.remainingCredits || 0)) || 660,
          usdAmount: p.packagePrice,
          date: new Date(p.createdAt || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          timestamp: new Date(p.createdAt || Date.now()).getTime(),
          paymentMethod: 'paypal',
          status: p.paymentStatus === 'paid' ? 'completed' : 'pending',
        });
      }

      if (p.usedCredits > 0) {
        list.push({
          id: `tx-deduct-${p.id}`,
          reference: p.projectCode || `HT-${p.id.slice(-6).toUpperCase()}`,
          clientEmail: p.email,
          clientName: p.clientName,
          type: 'service_deduction',
          creditsDelta: -p.usedCredits,
          usdAmount: 0,
          date: new Date(p.createdAt || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          timestamp: new Date(p.createdAt || Date.now()).getTime() + 1000,
          paymentMethod: 'credits',
          status: 'completed',
        });
      }
    });

    // Seed transaction history for back-office demonstration and testing
    list.push(
      {
        id: 'seed-tx-1',
        reference: 'HT-9428-FORGE',
        clientEmail: 'kira@example.com',
        clientName: 'Kira Vance (Twitch)',
        type: 'package_purchase',
        creditsDelta: 660,
        usdAmount: 1500.0,
        date: 'Oct 01, 2026',
        timestamp: 1790841600000,
        paymentMethod: 'paypal',
        status: 'completed',
      },
      {
        id: 'seed-tx-2',
        reference: 'HT-9428-FORGE',
        clientEmail: 'kira@example.com',
        clientName: 'Kira Vance (Twitch)',
        type: 'service_deduction',
        creditsDelta: -580,
        usdAmount: 0.0,
        date: 'Oct 01, 2026',
        timestamp: 1790841660000,
        paymentMethod: 'credits',
        status: 'completed',
      },
      {
        id: 'seed-tx-3',
        reference: 'HT-7714-VANGUARD',
        clientEmail: 'apex_org@esports.gg',
        clientName: 'Apex Vanguard Pro',
        type: 'package_purchase',
        creditsDelta: 1500,
        usdAmount: 3200.0,
        date: 'Sep 28, 2026',
        timestamp: 1790582400000,
        paymentMethod: 'paypal',
        status: 'completed',
      },
      {
        id: 'seed-tx-4',
        reference: 'HT-7714-VANGUARD',
        clientEmail: 'apex_org@esports.gg',
        clientName: 'Apex Vanguard Pro',
        type: 'service_deduction',
        creditsDelta: -1250,
        usdAmount: 0.0,
        date: 'Sep 29, 2026',
        timestamp: 1790668800000,
        paymentMethod: 'credits',
        status: 'completed',
      },
      {
        id: 'seed-tx-5',
        reference: 'HT-PASS-PROMO-90',
        clientEmail: 'partner@creator.tv',
        clientName: 'Partner Streamer Grant',
        type: 'promo_credit',
        creditsDelta: 150,
        usdAmount: 0.0,
        date: 'Sep 25, 2026',
        timestamp: 1790323200000,
        paymentMethod: 'promo',
        status: 'completed',
      }
    );

    return list;
  }, [projects]);

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={
        <Link href="/">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 px-3 rounded-md text-xs font-bold gap-1 shadow-xs bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Project</span>
          </Button>
        </Link>
      }
    >
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Console Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              INTERNAL BACK-OFFICE
            </div>
            <h1 className="scroll-m-20 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground lg:text-4xl">
              Agency Management Console
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Monitor production queues, update milestone status, and audit PayPal credit transactions.
            </p>
          </div>

          <FilterTabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'projects' | 'ledger' | 'messages')}
            size="sm"
            tabs={[
              { value: 'projects', label: 'Projects', count: projects.length },
              { value: 'messages', label: 'Client Communications (Live)', icon: MessageSquare },
              { value: 'ledger', label: 'Credit Ledger' },
            ]}
          />
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 sm:p-5 rounded-xl border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Verified Revenue
              </span>
              {isLoading ? (
                <Skeleton className="h-8 sm:h-9 w-28 rounded-md my-0.5" />
              ) : (
                <b className="text-2xl sm:text-3xl font-black text-foreground block font-mono tabular-nums mt-0.5">
                  ${totalRevenue.toLocaleString()}
                </b>
              )}
              <small className="text-xs text-amber-700 dark:text-amber-400 font-semibold block mt-0.5">PayPal confirmed orders</small>
            </div>
            <IconTile variant="soft" size="lg" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <DollarSign className="w-5 h-5" />
            </IconTile>
          </Card>

          <Card className="p-4 sm:p-5 rounded-xl border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Committed Credits
              </span>
              {isLoading ? (
                <Skeleton className="h-8 sm:h-9 w-28 rounded-md my-0.5" />
              ) : (
                <b className="text-2xl sm:text-3xl font-black text-foreground block font-mono tabular-nums mt-0.5">
                  {totalCreditsAllocated.toLocaleString()} CR
                </b>
              )}
              <small className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block mt-0.5">Active work scope value</small>
            </div>
            <IconTile variant="soft" size="lg" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Coins className="w-5 h-5" />
            </IconTile>
          </Card>

          <Card className="p-4 sm:p-5 rounded-xl border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Active Production
              </span>
              {isLoading ? (
                <Skeleton className="h-8 sm:h-9 w-16 rounded-md my-0.5" />
              ) : (
                <b className="text-2xl sm:text-3xl font-black text-foreground block font-mono tabular-nums mt-0.5">{activeOrdersCount}</b>
              )}
              <small className="text-xs text-blue-700 dark:text-blue-400 font-semibold block mt-0.5">In review or production</small>
            </div>
            <IconTile variant="soft" size="lg" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Clock className="w-5 h-5" />
            </IconTile>
          </Card>

          <Card className="p-4 sm:p-5 rounded-xl border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Delivered Work
              </span>
              {isLoading ? (
                <Skeleton className="h-8 sm:h-9 w-16 rounded-md my-0.5" />
              ) : (
                <b className="text-2xl sm:text-3xl font-black text-foreground block font-mono tabular-nums mt-0.5">{deliveredCount}</b>
              )}
              <small className="text-xs text-purple-700 dark:text-purple-400 font-semibold block mt-0.5">Completed asset packs</small>
            </div>
            <IconTile variant="soft" size="lg" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <CheckCircle className="w-5 h-5" />
            </IconTile>
          </Card>
        </div>

        {/* Tab 1: Projects Pipeline */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            <Card className="p-3 bg-secondary/35 border-border/80 rounded-xl shadow-none flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-amber-600" /> Filter Status:
                </span>
                <Select
                  value={statusFilter}
                  onValueChange={(val) => setStatusFilter(val as string)}
                >
                  <SelectTrigger className="h-9 text-sm bg-card min-w-[180px] rounded-lg">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects ({projects.length})</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="payment_confirmed">Payment Confirmed</SelectItem>
                    <SelectItem value="in_production">In Production</SelectItem>
                    <SelectItem value="review_round">Review Round</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card
                    key={i}
                    className="p-5 sm:p-6 rounded-xl border-border bg-card space-y-4 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                      <div className="flex items-start gap-3">
                        <Skeleton className="w-10 h-10 rounded-full shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-24 rounded-md" />
                            <Skeleton className="h-5 w-32 rounded-full" />
                          </div>
                          <Skeleton className="h-6 w-44 rounded-md" />
                          <Skeleton className="h-4 w-64 rounded-md" />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-24 rounded-xs" />
                          <Skeleton className="h-9 w-36 rounded-lg" />
                        </div>
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-24 rounded-xs" />
                          <Skeleton className="h-9 w-32 rounded-lg" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <Empty className="p-10 border border-dashed rounded-xl bg-secondary/20">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="size-12 rounded-lg">
                    <FolderOpen className="w-6 h-6 text-muted-foreground" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base font-bold">No Projects Found</EmptyTitle>
                  <EmptyDescription className="text-xs sm:text-sm">
                    No orders match status &ldquo;{statusFilter}&rdquo;. Try selecting a different filter.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              filteredProjects.map((p) => (
              <Card
                key={p.id}
                className="p-5 sm:p-6 rounded-xl border-border bg-card space-y-4 shadow-xs hover:border-amber-300 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 border border-border text-xs bg-amber-100 text-amber-800 font-bold shrink-0 mt-0.5">
                      <AvatarFallback>
                        {(p.channelName || p.clientName || 'C').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800">
                          {p.projectCode}
                        </span>
                        <Badge variant="outline" className="text-xs font-medium">
                          {p.packageName} (<span className="font-mono tabular-nums">${p.packagePrice.toLocaleString()}</span>)
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold text-foreground mt-1">
                        {p.channelName || p.clientName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Client: {p.clientName} · Email: {p.email} · Platform: {p.platform || 'General'}
                      </p>
                    </div>
                  </div>

                  {/* Status Dropdowns with Select */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                        Production Status
                      </span>
                      <Select
                        value={p.status}
                        disabled={isUpdating === p.id}
                        onValueChange={(val) =>
                          handleUpdateStatus(p.id, val as ProjectRecord['status'])
                        }
                      >
                        <SelectTrigger className="h-9 text-sm bg-card min-w-[150px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending_review">Pending Review</SelectItem>
                          <SelectItem value="payment_confirmed">Payment Confirmed</SelectItem>
                          <SelectItem value="in_production">In Production</SelectItem>
                          <SelectItem value="review_round">Review Round</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                        Payment Status
                      </span>
                      <Select
                        value={p.paymentStatus}
                        disabled={isUpdating === p.id}
                        onValueChange={(val) =>
                          handleUpdateStatus(
                            p.id,
                            p.status,
                            val as ProjectRecord['paymentStatus']
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-sm bg-card min-w-[120px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                        Channel Chat
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveProjectId(p.id);
                          setActiveTab('messages');
                        }}
                        className="h-9 text-xs font-semibold gap-1.5 rounded-lg border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                      >
                        <MessageSquare className="size-3.5 text-amber-600" />
                        <span>Open Chat</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <Card className="p-4 rounded-lg bg-secondary/30 border-border/80 shadow-none">
                    <CardHeader className="p-0 pb-1.5">
                      <CardTitle className="text-xs font-bold text-foreground">
                        Creative Instructions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{p.instructions}</p>
                      {p.redeemCode && (
                        <p className="mt-2 text-amber-800 dark:text-amber-300 font-semibold">
                          Promo code attached: <span className="font-mono tabular-nums">{p.redeemCode}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="p-4 rounded-lg bg-secondary/30 border-border/80 shadow-none">
                    <CardHeader className="p-0 pb-1.5">
                      <CardTitle className="text-xs font-bold text-foreground">
                        Service Items (<span className="font-mono tabular-nums">{p.usedCredits}</span> CR)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ul className="space-y-1">
                        {p.selections.map((sel, idx) => (
                          <li key={idx} className="flex justify-between items-center text-muted-foreground">
                            <span>• {sel.name} (Tier <span className="font-mono tabular-nums">{sel.level}</span> × <span className="font-mono tabular-nums">{sel.quantity}</span>)</span>
                            <CreditValue value={sel.credits} size="xs" />
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </Card>
            ))
          )}
          </div>
        )}

        {/* Tab 2: Credit Ledger using ReUI DataGrid */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <AgencyDataGrid transactions={ledgerTransactions} />
          </div>
        )}

        {/* TAB 3: Client Communications & Live Studio Chat */}
        {activeTab === 'messages' && (
          <div className="pt-2 animate-in fade-in duration-200">
            <ChatFullView />
          </div>
        )}
      </div>
    </StudioCardLayout>
  );
}
