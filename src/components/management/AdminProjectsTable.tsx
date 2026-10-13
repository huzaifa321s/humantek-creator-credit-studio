'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { FilterTabs } from '@/components/ui/filter-tabs';
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
  EmptyContent,
} from '@/components/ui/empty';
import {
  Search,
  RotateCcw,
  MessageSquare,
  Clock,
  FolderKanban,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Check,
  Loader2,
  FileText,
  Image as ImageIcon,
  Package,
} from 'lucide-react';
import {
  cn,
  formatStudioDate,
  formatStudioRelativeTime,
  getProjectStatusLabel,
  getPaymentStatusLabel,
} from '@/lib/utils';
import { useAdminProjectsQuery, useProjectDetailQuery } from '@/lib/queries/projects';
import { useManagementSummaryQuery } from '@/lib/queries/management';
import { ImageLightbox } from '@/components/ui/image-lightbox';

interface AdminProjectsTableProps {
  projects?: ProjectRecord[];
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
  projects: fallbackProjects,
  isLoading: fallbackLoading = false,
  onOpenChat,
  onUpdateStatus,
  isUpdatingId = null,
}: AdminProjectsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get('project');
  const urlStatus = searchParams.get('status');

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(urlStatus || 'all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(urlProjectId);
  const [draftStatus, setDraftStatus] = useState<ProjectRecord['status'] | null>(null);
  const [draftPayment, setDraftPayment] = useState<ProjectRecord['paymentStatus'] | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedProjectId(urlProjectId);
  }, [urlProjectId]);

  useEffect(() => {
    if (urlStatus && ['all', 'pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered', 'declined'].includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
  }, [urlStatus]);

  const handleSelectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (id) {
        params.set('project', id);
      } else {
        params.delete('project');
      }
      const query = params.toString();
      const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [router]);

  // Debounce search query so server queries run cleanly
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const adminQuery = useAdminProjectsQuery({
    page,
    limit: 25,
    status: statusFilter,
    paymentStatus: paymentFilter,
    search: debouncedSearch,
  });

  const { data: summary } = useManagementSummaryQuery();
  const summaryCounts = summary?.counts;
  const adminCounts = adminQuery.data?.counts;

  const projects = adminQuery.data?.projects ?? fallbackProjects ?? [];
  const totalCount = adminQuery.data?.totalCount ?? projects.length;
  const isLoading = adminQuery.isPending || fallbackLoading;
  const totalPages = Math.max(1, Math.ceil(totalCount / 25));

  const fromIndex = totalCount === 0 ? 0 : (page - 1) * 25 + 1;
  const toIndex = Math.min(page * 25, totalCount);

  // Tabs for quick studio status switching
  const filterTabs = useMemo(() => [
    { value: 'all', label: 'All Projects', count: summaryCounts?.projects ?? totalCount },
    { value: 'pending_review', label: 'Pending Review', count: summaryCounts?.pendingReview },
    { value: 'in_production', label: 'In Production', count: adminCounts?.active },
    { value: 'review_round', label: 'Review Round' },
    { value: 'delivered', label: 'Delivered', count: adminCounts?.delivered },
  ], [totalCount, summaryCounts, adminCounts]);

  // Load detailed single project when opened in drawer (for deliverables & additions)
  const detailQuery = useProjectDetailQuery(selectedProjectId);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    if (detailQuery.data && detailQuery.data.id === selectedProjectId) {
      return detailQuery.data;
    }
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId, detailQuery.data]);

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

  const resetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* 1. Studio Status Filter Tabs & Search Controls */}
      <div className="flex flex-col gap-3">
        {/* Top: Status Tabs using FilterTabs */}
        <FilterTabs
          value={['all', 'pending_review', 'in_production', 'review_round', 'delivered'].includes(statusFilter) ? statusFilter : 'all'}
          onValueChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          size="sm"
          tabs={filterTabs}
        />

        {/* Bottom Toolbar: Search & Secondary Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by code, client, or package..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-card rounded-lg border-border/80 focus-visible:border-amber-400"
              />
            </div>

            {/* Payment Filter Select */}
            <Select
              value={paymentFilter}
              onValueChange={(val) => {
                setPaymentFilter((val as string) || 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-card w-full sm:w-[140px] rounded-lg border-border/80">
                <SelectValue placeholder="All Payments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Payments
                </SelectItem>
                <SelectItem value="paid" className="text-xs">
                  Paid
                </SelectItem>
                <SelectItem value="unpaid" className="text-xs">
                  Unpaid
                </SelectItem>
                <SelectItem value="refunded" className="text-xs">
                  Refunded
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Counts & Clear Filters */}
          <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              Showing <b className="text-foreground">{fromIndex}–{toIndex}</b> of{' '}
              <b className="text-foreground">{totalCount}</b>
            </span>

            {(searchQuery || statusFilter !== 'all' || paymentFilter !== 'all') && (
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

      {/* 2. Projects Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-secondary/20 border-b border-border/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Code
              </TableHead>
              <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Client / Channel
              </TableHead>
              <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Package
              </TableHead>
              <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Production Status
              </TableHead>
              <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">
                Payment
              </TableHead>
              <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">
                Credits
              </TableHead>
              <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">
                Submitted
              </TableHead>
              <TableHead className="w-[110px] py-3 px-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell className="p-4"><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-8 w-44 rounded-md" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-5 w-32 rounded-md" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="p-4 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-md" /></TableCell>
                  <TableCell className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto rounded-md" /></TableCell>
                  <TableCell className="p-4 text-right"><Skeleton className="h-8 w-20 ml-auto rounded-md" /></TableCell>
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-12 shadow-xs my-6 mx-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FolderKanban className="size-6 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-lg font-bold text-foreground">
                        No matching client projects found
                      </EmptyTitle>
                      <EmptyDescription className="text-xs text-muted-foreground">
                        {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all'
                          ? `No projects matched your active filters. Try adjusting your search query or reset filters.`
                          : 'No client projects have been submitted yet.'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {(searchQuery || statusFilter !== 'all' || paymentFilter !== 'all') && (
                      <EmptyContent>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                          className="gap-1.5 cursor-pointer text-xs"
                        >
                          <RotateCcw className="size-3.5" />
                          <span>Clear all filters</span>
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p) => {
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors group"
                  >
                    {/* Code */}
                    <TableCell className="py-3.5 px-4">
                      <Badge
                        variant="outline"
                        size="sm"
                        className="font-mono tabular-nums text-brand-text dark:text-amber-300 bg-amber-400/10 border-amber-400/30 font-bold shrink-0"
                      >
                        {p.projectCode || p.id.slice(0, 8)}
                      </Badge>
                    </TableCell>

                    {/* Client / Channel */}
                    <TableCell className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8 rounded-lg border border-border text-2xs bg-amber-400/15 text-brand-text dark:text-amber-400 font-bold shrink-0">
                          <AvatarFallback>
                            {(p.channelName || p.clientName || 'C').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">
                            {p.channelName || p.clientName}
                          </div>
                          {p.channelName && p.clientName && p.channelName !== p.clientName && (
                            <div className="text-2xs text-muted-foreground truncate">
                              {p.clientName}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Package */}
                    <TableCell className="py-3.5 px-4">
                      <Badge variant="gold" size="sm" className="font-bold">
                        {p.packageName || 'Creative Scope'}
                      </Badge>
                    </TableCell>

                    {/* Production Status */}
                    <TableCell className="py-3.5 px-4">
                      <Badge
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs font-medium text-foreground shrink-0"
                      >
                        <span
                          className={cn(
                            'size-2 rounded-full shrink-0',
                            p.status === 'pending_review' && 'bg-amber-400 animate-pulse',
                            p.status === 'payment_confirmed' && 'bg-emerald-500',
                            p.status === 'in_production' && 'bg-amber-400 animate-pulse',
                            p.status === 'review_round' && 'bg-purple-500',
                            p.status === 'delivered' && 'bg-emerald-500',
                            !['pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered'].includes(p.status) && 'bg-muted-foreground/50'
                          )}
                        />
                        <span>{getProjectStatusLabel(p.status)}</span>
                      </Badge>
                    </TableCell>

                    {/* Payment */}
                    <TableCell className="py-3.5 px-4">
                      <Badge
                        variant={p.paymentStatus === 'paid' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {p.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </TableCell>

                    {/* Credits */}
                    <TableCell className="py-3.5 px-4 text-right">
                      <CreditValue
                        value={p.packageCredits || p.usedCredits || 0}
                        size="xs"
                        variant="pill"
                      />
                    </TableCell>

                    {/* Submitted */}
                    <TableCell
                      className="py-3.5 px-4 text-right text-xs text-muted-foreground font-mono tabular-nums"
                      title={formatStudioDate(p.createdAt)}
                    >
                      {formatStudioRelativeTime(p.createdAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          variant="gold"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProject(p.id);
                          }}
                          className="h-8 px-3 text-xs font-bold gap-1 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
                        >
                          <span>Manage</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer Bar */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs">
          <div className="text-xs text-muted-foreground font-medium">
            Showing <b className="text-foreground">{fromIndex}–{toIndex}</b> of{' '}
            <b className="text-foreground">{totalCount}</b> projects
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 text-xs font-semibold cursor-pointer gap-1 rounded-lg"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </Button>
            <span className="text-xs font-medium font-mono tabular-nums px-2 text-muted-foreground">
              Page <b className="text-foreground">{page}</b> of <b className="text-foreground">{totalPages}</b>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-3 text-xs font-semibold cursor-pointer gap-1 rounded-lg"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* 3. Detail Management Drawer (Sheet) */}
      <Sheet open={Boolean(selectedProject)} onOpenChange={(open) => !open && handleSelectProject(null)}>
        {selectedProject && (
          <SheetContent side="right" className="sm:max-w-md w-full p-0 flex flex-col h-full bg-card">
            {/* Drawer Header */}
            <SheetHeader className="p-5 border-b border-border/80 bg-secondary/15 shrink-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge
                  variant="outline"
                  size="sm"
                  className="font-mono tabular-nums text-brand-text dark:text-amber-300 bg-amber-400/10 border-amber-400/30 font-bold"
                >
                  {selectedProject.projectCode}
                </Badge>
                <Badge variant="gold" size="sm" className="font-bold">
                  {selectedProject.packageName} (${(selectedProject.packagePrice ?? 0).toLocaleString()})
                </Badge>
              </div>
              <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                {selectedProject.channelName || selectedProject.clientName}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Client: <b className="text-foreground font-medium">{selectedProject.clientName}</b> · {selectedProject.email} · {selectedProject.platform || 'General'}
              </SheetDescription>
            </SheetHeader>

            {/* Drawer Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Status Controls */}
              <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-brand-text dark:text-amber-400" />
                    <span>Production Management</span>
                  </div>
                  {isDirty && (
                    <Badge variant="warning" size="xs" className="gap-1 animate-pulse">
                      <span className="size-1.5 rounded-full bg-amber-400" />
                      <span>Unsaved Changes</span>
                    </Badge>
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
                      <SelectTrigger className="h-8 text-xs bg-background rounded-lg border-border/80">
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
                      <SelectTrigger className="h-8 text-xs bg-background rounded-lg border-border/80">
                        <SelectValue>
                          {getPaymentStatusLabel(draftPayment || selectedProject.paymentStatus)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid" className="text-xs">
                          Paid
                        </SelectItem>
                        <SelectItem value="unpaid" className="text-xs">
                          Unpaid
                        </SelectItem>
                        <SelectItem value="refunded" className="text-xs">
                          Refunded
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Staged Changes & Save Status Action Bar */}
                <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 text-2xs min-w-0">
                    {isDirty ? (
                      <span className="text-brand-text dark:text-amber-300 font-medium truncate">
                        Pending: {getProjectStatusLabel(selectedProject.status)} → {getProjectStatusLabel(draftStatus || selectedProject.status)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-medium flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
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
                      variant="gold"
                      size="sm"
                      disabled={!isDirty || isUpdating}
                      onClick={handleSaveStatus}
                      className="h-8 px-3 text-xs font-bold gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Check className="size-3.5" />
                          <span>Update Status</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Latest Discussion Preview */}
              {selectedProject.lastMessagePreview && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
                    <span>Latest Client Message</span>
                  </span>
                  <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/25 text-xs text-foreground/90 leading-relaxed italic">
                    &ldquo;{selectedProject.lastMessagePreview}&rdquo;
                  </div>
                </div>
              )}

              {/* Creative Instructions */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5 text-brand-text dark:text-amber-400" />
                  <span>Creative Instructions</span>
                </span>
                <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/80 text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedProject.instructions || 'No specific creative notes submitted.'}
                </div>
                {selectedProject.redeemCode && (
                  <p className="text-2xs text-brand-text dark:text-amber-300 font-semibold pt-1">
                    Promo code attached: <span className="font-mono tabular-nums">{selectedProject.redeemCode}</span>
                  </p>
                )}
              </div>

              {/* Reference Images (Step 4) */}
              {(selectedProject.uploadedFiles?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="size-3.5 text-brand-text dark:text-amber-400" />
                    <span>Reference Images ({selectedProject.uploadedFiles.length})</span>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedProject.uploadedFiles.map((file, i) =>
                      file.url ? (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setActiveImageIndex(i)}
                          title={file.filename}
                          aria-label={`Enlarge reference image: ${file.filename}`}
                          className="group relative aspect-square overflow-hidden rounded-lg border border-border/80 bg-secondary/20 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 cursor-pointer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={file.url}
                            alt={file.filename}
                            loading="lazy"
                            className="size-full object-cover transition-transform group-hover:scale-105"
                          />
                        </button>
                      ) : (
                        <div
                          key={file.id}
                          title={`${file.filename} (preview unavailable)`}
                          className="aspect-square flex items-center justify-center rounded-lg border border-dashed border-border/80 text-muted-foreground"
                        >
                          <ImageIcon className="size-4" />
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Service Items Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Package className="size-3.5 text-brand-text dark:text-amber-400" />
                    <span>
                      Deliverable Items ({selectedProject.selections?.length || 0})
                    </span>
                  </span>
                  <CreditValue value={selectedProject.usedCredits || 0} size="xs" variant="pill" />
                </div>

                <div className="rounded-xl border border-border/80 bg-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                  {selectedProject.selections && selectedProject.selections.length > 0 ? (
                    selectedProject.selections.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-foreground">{item.name}</span>
                          <span className="text-muted-foreground ml-1.5 font-mono text-2xs">
                            ({item.quantity}x)
                          </span>
                        </div>
                        <CreditValue value={item.credits} size="xs" variant="pill" />
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
                onClick={() => handleSelectProject(null)}
                className="h-8 text-xs rounded-lg cursor-pointer"
              >
                Close Drawer
              </Button>

              {onOpenChat && (
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  onClick={() => {
                    const id = selectedProject.id;
                    handleSelectProject(null);
                    onOpenChat(id);
                  }}
                  className="h-8 text-xs font-bold gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Open Client Messages</span>
                </Button>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>

      {/* Unified Accessible Full-Screen Lightbox Portal (Layer Scale z-60) */}
      <ImageLightbox
        images={(selectedProject?.uploadedFiles || []).map((f) => ({
          id: f.id,
          url: f.url || '',
          filename: f.filename,
          size: f.size,
          mimeType: f.mimeType,
          storagePath: f.storagePath,
        }))}
        initialIndex={activeImageIndex ?? 0}
        open={activeImageIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setActiveImageIndex(null);
        }}
      />
    </div>
  );
}
