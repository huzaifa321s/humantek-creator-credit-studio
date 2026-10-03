'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ProjectRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/reui/badge';
import { IconTile } from '@/components/reui/icon-tile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import { ChatFullView } from '@/components/chat/ChatFullView';

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<'projects' | 'ledger' | 'messages'>('projects');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleUpdateStatus = async (
    id: string,
    newStatus: ProjectRecord['status'],
    newPayment?: ProjectRecord['paymentStatus']
  ) => {
    setIsUpdating(id);
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, paymentStatus: newPayment }),
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...data.project } : p))
        );
        toast.success(`Updated project status to ${newStatus.replace('_', ' ')}`);
      } else {
        toast.error('Failed to update status');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error updating status');
    } finally {
      setIsUpdating(null);
    }
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

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={
        <Link href="/">
          <Button variant="outline" size="sm" className="text-xs rounded-xl cursor-pointer">
            Open Studio Wizard
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

          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'projects' | 'ledger')}
            className="w-auto"
          >
            <TabsList className="bg-secondary/70 p-1 rounded-xl">
              <TabsTrigger
                value="projects"
                className="text-sm font-semibold px-3.5 py-1.5 data-active:bg-card data-active:text-amber-700 data-active:shadow-2xs"
              >
                Projects ({projects.length})
              </TabsTrigger>
              <TabsTrigger
                value="messages"
                className="text-sm font-semibold px-3.5 py-1.5 data-active:bg-card data-active:text-amber-700 data-active:shadow-2xs gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                <span>Client Communications (Live)</span>
              </TabsTrigger>
              <TabsTrigger
                value="ledger"
                className="text-sm font-semibold px-3.5 py-1.5 data-active:bg-card data-active:text-amber-700 data-active:shadow-2xs"
              >
                Credit Ledger
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 sm:p-5 rounded-2xl border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Verified Revenue
              </span>
              <b className="text-2xl sm:text-3xl font-black text-foreground block tabular-nums mt-0.5">
                ${totalRevenue.toLocaleString()}
              </b>
              <small className="text-xs text-amber-700 dark:text-amber-400 font-semibold block mt-0.5">PayPal confirmed orders</small>
            </div>
            <IconTile variant="soft" size="lg" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <DollarSign className="w-5 h-5" />
            </IconTile>
          </Card>

          <Card className="p-4 sm:p-5 rounded-2xl border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Committed Credits
              </span>
              <b className="text-2xl sm:text-3xl font-black text-foreground block tabular-nums mt-0.5">
                {totalCreditsAllocated.toLocaleString()} CR
              </b>
              <small className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block mt-0.5">Active work scope value</small>
            </div>
            <IconTile variant="soft" size="lg" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Coins className="w-5 h-5" />
            </IconTile>
          </Card>

          <Card className="p-4 sm:p-5 rounded-2xl border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Active Production
              </span>
              <b className="text-2xl sm:text-3xl font-black text-foreground block mt-0.5">{activeOrdersCount}</b>
              <small className="text-xs text-blue-700 dark:text-blue-400 font-semibold block mt-0.5">In review or production</small>
            </div>
            <IconTile variant="soft" size="lg" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Clock className="w-5 h-5" />
            </IconTile>
          </Card>

          <Card className="p-4 sm:p-5 rounded-2xl border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Delivered Work
              </span>
              <b className="text-2xl sm:text-3xl font-black text-foreground block mt-0.5">{deliveredCount}</b>
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
            <Card className="p-3 bg-secondary/35 border-border/80 rounded-2xl shadow-none flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-amber-600" /> Filter Status:
                </span>
                <Select
                  value={statusFilter}
                  onValueChange={(val) => setStatusFilter(val as string)}
                >
                  <SelectTrigger className="h-9 text-sm bg-card min-w-[180px] rounded-xl">
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

            {filteredProjects.length === 0 ? (
              <Empty className="p-10 border border-dashed rounded-2xl bg-secondary/20">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="size-12 rounded-xl">
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
                className="p-5 sm:p-6 rounded-2xl border-border bg-card space-y-4 shadow-sm hover:border-amber-300 transition-all"
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
                          {p.packageName} (${p.packagePrice.toLocaleString()})
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
                        <SelectTrigger className="h-9 text-sm bg-card min-w-[150px] rounded-xl">
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
                        <SelectTrigger className="h-9 text-sm bg-card min-w-[120px] rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <Card className="p-4 rounded-xl bg-secondary/30 border-border/80 shadow-none">
                    <CardHeader className="p-0 pb-1.5">
                      <CardTitle className="text-xs font-bold text-foreground">
                        Creative Instructions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{p.instructions}</p>
                      {p.redeemCode && (
                        <p className="mt-2 text-amber-800 dark:text-amber-300 font-semibold">
                          Voucher attached: {p.redeemCode}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="p-4 rounded-xl bg-secondary/30 border-border/80 shadow-none">
                    <CardHeader className="p-0 pb-1.5">
                      <CardTitle className="text-xs font-bold text-foreground">
                        Service Items ({p.usedCredits} CR)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ul className="space-y-1">
                        {p.selections.map((sel, idx) => (
                          <li key={idx} className="flex justify-between items-center text-muted-foreground">
                            <span>• {sel.name} (Tier {sel.level} × {sel.quantity})</span>
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

        {/* Tab 2: Credit Ledger using Table */}
        {activeTab === 'ledger' && (
          <Card className="rounded-xl border-border bg-card overflow-hidden shadow-2xs">
            <CardHeader className="p-4 border-b border-border/80 bg-muted/30">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600" /> Audited Transaction Ledger
              </CardTitle>
            </CardHeader>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border/80 hover:bg-transparent">
                    <TableHead className="pl-6 font-semibold text-sm text-foreground/80 h-11">Reference</TableHead>
                    <TableHead className="font-semibold text-sm text-foreground/80 h-11">Client Email</TableHead>
                    <TableHead className="font-semibold text-sm text-foreground/80 h-11">Type</TableHead>
                    <TableHead className="font-semibold text-sm text-foreground/80 text-right h-11">Credits Delta</TableHead>
                    <TableHead className="font-semibold text-sm text-foreground/80 text-right h-11">USD Amount</TableHead>
                    <TableHead className="pr-6 font-semibold text-sm text-foreground/80 text-right h-11">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-muted/50 transition-colors border-b border-border/60">
                    <TableCell className="pl-6 font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">
                      HT-9428-FORGE
                    </TableCell>
                    <TableCell className="text-foreground text-sm font-medium">
                      kira@example.com
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="text-xs font-semibold px-2 py-0.5">
                        package_purchase
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <CreditValue value="+660" size="sm" variant="delta" />
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground text-sm tabular-nums">
                      $1,500.00
                    </TableCell>
                    <TableCell className="pr-6 text-right text-muted-foreground text-sm">
                      Oct 01, 2026
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-muted/50 transition-colors border-b border-border/60">
                    <TableCell className="pl-6 font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">
                      HT-9428-FORGE
                    </TableCell>
                    <TableCell className="text-foreground text-sm font-medium">
                      kira@example.com
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-semibold text-amber-700 dark:text-amber-400 border-amber-300 px-2 py-0.5">
                        service_deduction
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <CreditValue value="-580" size="sm" variant="delta" />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                      $0.00
                    </TableCell>
                    <TableCell className="pr-6 text-right text-muted-foreground text-sm">
                      Oct 01, 2026
                    </TableCell>
                  </TableRow>
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="pl-6 font-semibold text-sm text-foreground">
                      Audited Net Credits Balance (2 Records)
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm text-foreground">
                      <CreditValue value="+80" size="sm" variant="delta" />
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm text-foreground tabular-nums">
                      $1,500.00
                    </TableCell>
                    <TableCell className="pr-6" />
                  </TableRow>
                </TableFooter>
              </Table>
            </ScrollArea>
          </Card>
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
