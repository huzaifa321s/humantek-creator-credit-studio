'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ProjectRecord } from '@/types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CreditValue } from '@/components/ui/credit-value';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Search,
  Filter,
  RotateCcw,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  FileText,
  Package,
  Layers,
  Check,
  Loader2,
} from 'lucide-react';
import {
  cn,
  formatStudioDate,
  getProjectStatusLabel,
  getPaymentStatusLabel,
} from '@/lib/utils';

interface AdminProjectsTableProps {
  projects: ProjectRecord[];
  isLoading?: boolean;
  onOpenChat?: (projectId: string) => void;
  onUpdateStatus: (
    id: string,
    newStatus: ProjectRecord['status'],
    newPayment?: ProjectRecord['paymentStatus']
  ) => void;
  isUpdatingId?: string | null;
}

export function AdminProjectsTable({
  projects,
  isLoading = false,
  onOpenChat,
  onUpdateStatus,
  isUpdatingId = null,
}: AdminProjectsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<ProjectRecord['status'] | null>(null);
  const [draftPayment, setDraftPayment] = useState<ProjectRecord['paymentStatus'] | null>(null);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProject) {
      setDraftStatus(selectedProject.status);
      setDraftPayment(selectedProject.paymentStatus);
    } else {
      setDraftStatus(null);
      setDraftPayment(null);
    }
  }, [selectedProject?.id, selectedProject?.status, selectedProject?.paymentStatus]);

  const isUpdating = isUpdatingId === selectedProject?.id;
  const isDirty = Boolean(
    selectedProject &&
      ((draftStatus && draftStatus !== selectedProject.status) ||
        (draftPayment && draftPayment !== selectedProject.paymentStatus))
  );

  const handleSaveStatus = () => {
    if (!selectedProject || !draftStatus) return;
    onUpdateStatus(
      selectedProject.id,
      draftStatus,
      draftPayment || selectedProject.paymentStatus
    );
  };

  const handleResetDraft = () => {
    if (!selectedProject) return;
    setDraftStatus(selectedProject.status);
    setDraftPayment(selectedProject.paymentStatus);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.projectCode.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        (p.channelName && p.channelName.toLowerCase().includes(q)) ||
        p.email.toLowerCase().includes(q) ||
        p.packageName.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  const getStatusBadge = (status: ProjectRecord['status']) => {
    switch (status) {
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Pending Review</span>
          </span>
        );
      case 'payment_confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Payment Confirmed</span>
          </span>
        );
      case 'in_production':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>In Production</span>
          </span>
        );
      case 'review_round':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Review Round</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Delivered</span>
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Declined</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <span>{getProjectStatusLabel(status)}</span>
          </span>
        );
    }
  };

  const getPaymentBadge = (paymentStatus: ProjectRecord['paymentStatus']) => {
    if (paymentStatus === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Paid</span>
        </span>
      );
    }
    if (paymentStatus === 'refunded') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
          <span>Refunded</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Unpaid</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Unified Back-Office Toolbar matching Ledger */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/35 border border-border/80">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search code, client, platform, package..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-card rounded-lg border-border/80"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter((val as string) || 'all')}
          >
            <SelectTrigger className="h-9 text-xs bg-card min-w-[170px] rounded-lg border-border/80">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Projects ({projects.length})
              </SelectItem>
              <SelectItem value="pending_review" className="text-xs">
                Pending Review
              </SelectItem>
              <SelectItem value="payment_confirmed" className="text-xs">
                Payment Confirmed
              </SelectItem>
              <SelectItem value="in_production" className="text-xs">
                In Production
              </SelectItem>
              <SelectItem value="review_round" className="text-xs">
                Review Round
              </SelectItem>
              <SelectItem value="delivered" className="text-xs">
                Delivered
              </SelectItem>
              <SelectItem value="declined" className="text-xs">
                Declined
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 justify-between md:justify-end shrink-0">
          <span className="text-xs text-muted-foreground font-medium">
            Showing <b className="text-foreground">{filteredProjects.length}</b>{' '}
            {filteredProjects.length === 1 ? 'project' : 'projects'}
          </span>

          {(searchQuery || statusFilter !== 'all') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Projects Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-secondary/40 border-b border-border/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Code
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Client / Channel
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Package
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Production Status
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Payment
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">
                Credits
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">
                Updated
              </TableHead>
              <TableHead className="w-[80px] py-3 px-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell className="p-4"><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-8 w-44 rounded-md" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-5 w-32 rounded-md" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="p-4 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-md" /></TableCell>
                  <TableCell className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto rounded-md" /></TableCell>
                  <TableCell className="p-4 text-right"><Skeleton className="h-8 w-16 ml-auto rounded-md" /></TableCell>
                </TableRow>
              ))
            ) : filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <Empty className="p-10 bg-transparent">
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="size-12 rounded-lg">
                        <FolderOpen className="w-6 h-6 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base font-bold">No Projects Found</EmptyTitle>
                      <EmptyDescription className="text-xs sm:text-sm">
                        No orders match your search criteria. Try clearing the filter.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className="cursor-pointer hover:bg-muted/40 transition-colors group"
                >
                  {/* Code */}
                  <TableCell className="py-3 px-4 font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
                    <span className="bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300/80 dark:border-amber-800/80">
                      {p.projectCode}
                    </span>
                  </TableCell>

                  {/* Client / Channel */}
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="w-8 h-8 rounded-lg border border-border text-2xs bg-amber-100 text-amber-800 font-bold shrink-0">
                        <AvatarFallback>
                          {(p.channelName || p.clientName || 'C').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">
                          {p.clientName}
                        </div>
                        <div className="text-2xs text-muted-foreground truncate">
                          {p.channelName && `${p.channelName} · `}
                          {p.platform || 'General'}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Package */}
                  <TableCell className="py-3 px-4">
                    <div className="text-xs font-medium text-foreground">
                      {p.packageName}
                    </div>
                    <div className="text-2xs font-mono tabular-nums text-muted-foreground">
                      ${p.packagePrice.toLocaleString()}
                    </div>
                  </TableCell>

                  {/* Production Status */}
                  <TableCell className="py-3 px-4">
                    {getStatusBadge(p.status)}
                  </TableCell>

                  {/* Payment */}
                  <TableCell className="py-3 px-4">
                    {getPaymentBadge(p.paymentStatus)}
                  </TableCell>

                  {/* Credits */}
                  <TableCell className="py-3 px-4 text-right">
                    <CreditValue value={p.usedCredits} size="xs" />
                  </TableCell>

                  {/* Updated */}
                  <TableCell className="py-3 px-4 text-right text-xs text-muted-foreground font-mono tabular-nums">
                    {formatStudioDate(p.createdAt)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-3 px-4 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjectId(p.id);
                      }}
                      className="h-8 px-2.5 text-xs text-muted-foreground group-hover:text-foreground cursor-pointer gap-1"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 3. Detail Drawer (Sheet) */}
      <Sheet open={Boolean(selectedProject)} onOpenChange={(open) => !open && setSelectedProjectId(null)}>
        {selectedProject && (
          <SheetContent side="right" className="sm:max-w-md w-full p-0 flex flex-col h-full bg-card">
            {/* Drawer Header */}
            <SheetHeader className="p-5 border-b border-border/80 bg-secondary/20 shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800">
                  {selectedProject.projectCode}
                </span>
                <Badge variant="outline" className="text-xs font-medium">
                  {selectedProject.packageName} (${selectedProject.packagePrice.toLocaleString()})
                </Badge>
              </div>
              <SheetTitle className="text-lg font-bold text-foreground">
                {selectedProject.channelName || selectedProject.clientName}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Client: {selectedProject.clientName} · {selectedProject.email} · Platform: {selectedProject.platform || 'General'}
              </SheetDescription>
            </SheetHeader>

            {/* Drawer Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Status Controls */}
              <div className="p-4 rounded-xl bg-secondary/35 border border-border/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Production Management</span>
                  </div>
                  {isDirty && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Unsaved Changes</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                  <div>
                    <label className="text-2xs font-bold text-muted-foreground uppercase block mb-1">
                      Production Status
                    </label>
                    <Select
                      value={draftStatus || selectedProject.status}
                      disabled={isUpdating}
                      onValueChange={(val) => {
                        if (!val) return;
                        setDraftStatus(val as ProjectRecord['status']);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-card rounded-lg border-border/80">
                        <SelectValue>
                          {getProjectStatusLabel(draftStatus || selectedProject.status)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending_review" className="text-xs">Pending Review</SelectItem>
                        <SelectItem value="payment_confirmed" className="text-xs">Payment Confirmed</SelectItem>
                        <SelectItem value="in_production" className="text-xs">In Production</SelectItem>
                        <SelectItem value="review_round" className="text-xs">Review Round</SelectItem>
                        <SelectItem value="delivered" className="text-xs">Delivered</SelectItem>
                        <SelectItem value="declined" className="text-xs">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-muted-foreground uppercase block mb-1">
                      Payment Verification
                    </label>
                    <Select
                      value={draftPayment || selectedProject.paymentStatus}
                      disabled={isUpdating}
                      onValueChange={(val) => {
                        if (!val) return;
                        setDraftPayment(val as ProjectRecord['paymentStatus']);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-card rounded-lg border-border/80">
                        <SelectValue>
                          {getPaymentStatusLabel(draftPayment || selectedProject.paymentStatus)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid" className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Paid</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="unpaid" className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Unpaid</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="refunded" className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                            <span>Refunded</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Staged Changes & Save Status Action Bar */}
                <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 text-2xs min-w-0">
                    {isDirty ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-medium truncate">
                        <span className="truncate">
                          Pending: {getProjectStatusLabel(selectedProject.status)} → {getProjectStatusLabel(draftStatus || selectedProject.status)}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Status is up to date</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {isDirty && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isUpdating}
                        onClick={handleResetDraft}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Reset
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      disabled={!isDirty || isUpdating}
                      onClick={handleSaveStatus}
                      className={cn(
                        'h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg transition-all cursor-pointer shadow-xs',
                        isDirty
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-muted text-muted-foreground opacity-60 cursor-not-allowed'
                      )}
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Update Status</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Creative Instructions */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>Creative Instructions</span>
                </span>
                <div className="p-3.5 rounded-xl bg-secondary/25 border border-border/80 text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedProject.instructions || 'No specific creative notes submitted.'}
                </div>
                {selectedProject.redeemCode && (
                  <p className="text-2xs text-amber-800 dark:text-amber-300 font-semibold pt-1">
                    Promo code attached: <span className="font-mono tabular-nums">{selectedProject.redeemCode}</span>
                  </p>
                )}
              </div>

              {/* Service Items Breakdown — with item count and clean formatting */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-600" />
                    <span>
                      Deliverable Items ({selectedProject.selections?.length || 0})
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-xs font-bold text-foreground">
                    {selectedProject.usedCredits} CR Total
                  </span>
                </div>

                <div className="rounded-xl border border-border/80 bg-card divide-y divide-border/60 overflow-hidden">
                  {selectedProject.selections && selectedProject.selections.length > 0 ? (
                    selectedProject.selections.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-foreground">{item.name}</span>
                          <span className="text-muted-foreground ml-1.5 font-mono text-2xs">
                            ({item.quantity}x)
                          </span>
                        </div>
                        <CreditValue value={item.credits} size="xs" />
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-muted-foreground">Standard package scope</div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-border/80 bg-secondary/15 flex items-center justify-between gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedProjectId(null)}
                className="h-9 text-xs rounded-lg cursor-pointer"
              >
                Close Drawer
              </Button>

              {onOpenChat && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const id = selectedProject.id;
                    setSelectedProjectId(null);
                    onOpenChat(id);
                  }}
                  className="h-9 text-xs font-semibold gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-2xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Client Discussion</span>
                </Button>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
