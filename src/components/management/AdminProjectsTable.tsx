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
  ResponsiveTableShell,
  ResponsiveDesktopView,
  MobileCardList,
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardBody,
  MobileDataCardFooter,
  MobileDataCardActions,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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
  Zap,
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
import { ReferenceImageGrid } from '@/components/ui/reference-image-grid';
import {
  ProjectDrawerSpecsCard,
  ProjectDrawerBriefSection,
  ProjectDrawerLinksSection,
  ProjectDrawerServicesSection,
  ProjectDrawerSkeleton,
  ProjectDrawerNotFound,
} from '@/components/projects/ProjectDrawerSections';

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

  const [prevUrlProjectId, setPrevUrlProjectId] = useState(urlProjectId);
  if (urlProjectId !== prevUrlProjectId) {
    setPrevUrlProjectId(urlProjectId);
    setSelectedProjectId(urlProjectId);
  }

  const [prevUrlStatus, setPrevUrlStatus] = useState(urlStatus);
  if (urlStatus !== prevUrlStatus) {
    setPrevUrlStatus(urlStatus);
    if (
      urlStatus &&
      [
        'all',
        'pending_review',
        'payment_confirmed',
        'in_production',
        'review_round',
        'delivered',
        'declined',
      ].includes(urlStatus)
    ) {
      setStatusFilter(urlStatus);
    }
  }

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

  // Preserve last known tab counts across filter switches so badges never flicker
  const [persistedCounts, setPersistedCounts] = useState(adminCounts);
  if (adminCounts && adminCounts !== persistedCounts) {
    setPersistedCounts(adminCounts);
  }
  const counts = adminCounts ?? persistedCounts;

  const projects = useMemo(
    () => adminQuery.data?.projects ?? fallbackProjects ?? [],
    [adminQuery.data?.projects, fallbackProjects]
  );
  const totalCount = adminQuery.data?.totalCount ?? projects.length;
  const isLoading = adminQuery.isPending || fallbackLoading;
  const totalPages = Math.max(1, Math.ceil(totalCount / 25));

  const fromIndex = totalCount === 0 ? 0 : (page - 1) * 25 + 1;
  const toIndex = Math.min(page * 25, totalCount);

  // Tabs for quick studio status switching with accurate per-status counts
  const filterTabs = useMemo(() => {
    const tabs: { value: string; label: string; count?: number }[] = [
      { value: 'all', label: 'All Projects', count: counts?.all ?? summaryCounts?.projects ?? totalCount },
      { value: 'pending_review', label: 'Pending Review', count: counts?.pending_review ?? summaryCounts?.pendingReview ?? 0 },
    ];
    if ((counts?.payment_confirmed ?? 0) > 0 || statusFilter === 'payment_confirmed') {
      tabs.push({
        value: 'payment_confirmed',
        label: 'Payment Confirmed',
        count: counts?.payment_confirmed ?? 0,
      });
    }
    tabs.push(
      { value: 'in_production', label: 'In Production', count: counts?.in_production ?? 0 },
      { value: 'review_round', label: 'Review Round', count: counts?.review_round ?? 0 },
      { value: 'delivered', label: 'Delivered', count: counts?.delivered ?? 0 }
    );
    if ((counts?.declined ?? 0) > 0 || statusFilter === 'declined') {
      tabs.push({
        value: 'declined',
        label: 'Declined',
        count: counts?.declined ?? 0,
      });
    }
    return tabs;
  }, [totalCount, summaryCounts, counts, statusFilter]);

  const handleStatusTabChange = useCallback(
    (val: string) => {
      setStatusFilter(val);
      setPage(1);
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (val && val !== 'all') {
          params.set('status', val);
        } else {
          params.delete('status');
        }
        const query = params.toString();
        const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        router.replace(newUrl, { scroll: false });
      }
    },
    [router]
  );

  // Load detailed single project when opened in drawer (for deliverables & additions)
  const detailQuery = useProjectDetailQuery(selectedProjectId);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    if (detailQuery.data && detailQuery.data.id === selectedProjectId) {
      return detailQuery.data;
    }
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId, detailQuery.data]);

  const selectedSyncKey = selectedProject
    ? `${selectedProject.id}-${selectedProject.status}-${selectedProject.paymentStatus}`
    : 'none';
  const [prevSelectedSyncKey, setPrevSelectedSyncKey] = useState(selectedSyncKey);
  if (selectedSyncKey !== prevSelectedSyncKey) {
    setPrevSelectedSyncKey(selectedSyncKey);
    if (selectedProject) {
      setDraftStatus(selectedProject.status);
      setDraftPayment(selectedProject.paymentStatus);
    } else {
      setDraftStatus(null);
      setDraftPayment(null);
    }
  }

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
    setPaymentFilter('all');
    handleStatusTabChange('all');
  };

  return (
    <div className="space-y-4">
      {/* 1. Studio Status Filter Tabs & Search Controls */}
      <div className="flex flex-col gap-3">
        {/* Top: Status Tabs using FilterTabs */}
        <FilterTabs
          value={filterTabs.some((t) => t.value === statusFilter) ? statusFilter : 'all'}
          onValueChange={handleStatusTabChange}
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
                <SelectValue>
                  {paymentFilter === 'all'
                    ? 'All Payments'
                    : getPaymentStatusLabel(paymentFilter as ProjectRecord['paymentStatus'])}
                </SelectValue>
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

      {/* 2. Projects Responsive List (Mobile Cards + Desktop Table) */}
      <ResponsiveTableShell>
        {isLoading ? (
          <>
            {/* Mobile Loading Skeleton */}
            <MobileCardList>
              {Array.from({ length: 4 }).map((_, idx) => (
                <MobileDataCard key={idx}>
                  <MobileDataCardHeader>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-24 rounded-md" />
                      <Skeleton className="h-5 w-28 rounded-md" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </MobileDataCardHeader>
                  <MobileDataCardBody>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32 rounded-md" />
                      <Skeleton className="h-3 w-24 rounded-md" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </MobileDataCardBody>
                  <MobileDataCardFooter>
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <MobileDataCardActions>
                      <Skeleton className="h-8 w-20 rounded-lg" />
                      <Skeleton className="h-8 w-24 rounded-lg" />
                    </MobileDataCardActions>
                  </MobileDataCardFooter>
                </MobileDataCard>
              ))}
            </MobileCardList>

            {/* Desktop Loading Skeleton */}
            <ResponsiveDesktopView>
              <Table className="min-w-[760px]">
                <TableHeader className="bg-secondary/20 border-b border-border/70">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Code</TableHead>
                    <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Client / Channel</TableHead>
                    <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Package</TableHead>
                    <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Production Status</TableHead>
                    <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4">Payment</TableHead>
                    <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">Credits</TableHead>
                    <TableHead className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">Submitted</TableHead>
                    <TableHead sticky="right" className="w-[140px] py-3 px-4 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="p-4"><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                      <TableCell className="p-4"><Skeleton className="h-8 w-44 rounded-md" /></TableCell>
                      <TableCell className="p-4"><Skeleton className="h-5 w-32 rounded-md" /></TableCell>
                      <TableCell className="p-4"><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                      <TableCell className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="p-4 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-md" /></TableCell>
                      <TableCell className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto rounded-md" /></TableCell>
                      <TableCell sticky="right" className="p-4 text-right"><Skeleton className="h-8 w-24 ml-auto rounded-md" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveDesktopView>
          </>
        ) : projects.length === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-10 sm:p-12 shadow-xs my-6 mx-4">
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
        ) : (
          <>
            {/* MOBILE VIEW (< md): Reusable Design-System Mobile Cards */}
            <MobileCardList>
              {projects.map((p) => (
                <AdminProjectMobileCard
                  key={p.id}
                  project={p}
                  onSelect={handleSelectProject}
                  onOpenChat={onOpenChat}
                />
              ))}
            </MobileCardList>

            {/* DESKTOP VIEW (md+): Full Table with Sticky Right Actions Column */}
            <ResponsiveDesktopView>
              <Table className="min-w-[760px]">
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
                    <TableHead
                      sticky="right"
                      className="font-bold text-2xs uppercase tracking-wider text-muted-foreground py-3 px-4 text-right"
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <AdminProjectTableRow
                      key={p.id}
                      project={p}
                      onSelect={handleSelectProject}
                      onOpenChat={onOpenChat}
                    />
                  ))}
                </TableBody>
              </Table>
            </ResponsiveDesktopView>
          </>
        )}
      </ResponsiveTableShell>

      {/* Pagination Footer Bar */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs">
          <div className="text-xs text-muted-foreground font-medium">
            Showing <b className="text-foreground">{fromIndex}–{toIndex}</b> of{' '}
            <b className="text-foreground">{totalCount}</b> projects
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
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
      <Sheet open={Boolean(selectedProjectId)} onOpenChange={(open) => !open && handleSelectProject(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg md:max-w-xl p-0 flex flex-col h-dvh overflow-hidden bg-card border-l border-border/80 shadow-2xl"
        >
          {/* Drawer Header (pr-12 reserves room for the top-right close button) */}
          <SheetHeader className="p-4 sm:p-5 pr-12 border-b border-border/80 bg-secondary/15 shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap min-w-0">
              {selectedProject ? (
                <>
                  <Badge
                    variant="outline"
                    size="sm"
                    className="font-mono tabular-nums text-brand-text dark:text-amber-300 bg-amber-400/10 border-amber-400/30 font-bold shrink-0"
                  >
                    {selectedProject.projectCode}
                  </Badge>
                  <Badge variant="gold" size="sm" className="font-bold truncate max-w-[200px]">
                    {selectedProject.packageName} (${(selectedProject.packagePrice ?? 0).toLocaleString()})
                  </Badge>
                  {selectedProject.additions?.includes('rush') && (
                    <Badge
                      variant="warning"
                      size="sm"
                      className="font-semibold text-2xs gap-1 shrink-0"
                    >
                      <Zap className="size-3" />
                      <span>Rush</span>
                    </Badge>
                  )}
                </>
              ) : detailQuery.isPending ? (
                <>
                  <Skeleton className="h-5 w-24 rounded-md" />
                  <Skeleton className="h-5 w-28 rounded-md" />
                </>
              ) : null}
            </div>
            <SheetTitle className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
              {!selectedProject && detailQuery.isPending ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                selectedProject?.channelName || selectedProject?.clientName || 'Project Details'
              )}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 break-all sm:break-normal">
              {selectedProject ? (
                <>
                  <span>
                    Client: <b className="text-foreground font-medium">{selectedProject.clientName}</b>
                  </span>
                  <span>·</span>
                  <span className="truncate max-w-full">{selectedProject.email}</span>
                  <span>·</span>
                  <span>{selectedProject.platform || 'General'}</span>
                </>
              ) : detailQuery.isPending ? (
                <Skeleton className="h-4 w-56" />
              ) : null}
            </SheetDescription>
          </SheetHeader>

          {/* Drawer Body */}
          <ScrollArea className="flex-1 min-h-0 w-full">
            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 text-xs select-text min-w-0">
              {!selectedProject && detailQuery.isPending ? (
                <ProjectDrawerSkeleton showStatusCard />
              ) : !selectedProject ? (
                <ProjectDrawerNotFound
                  onClose={() => handleSelectProject(null)}
                  onRetry={() => detailQuery.refetch()}
                />
              ) : (
                <>
                  {/* Status Controls */}
                  <Card className="border-border/80 shadow-2xs min-w-0">
                    <CardHeader className="p-3.5 sm:p-4 pb-2.5 sm:pb-3">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 min-w-0 truncate">
                          <ShieldCheck className="size-4 text-brand-text dark:text-amber-400 shrink-0" />
                          <span className="truncate">Production Management</span>
                        </div>
                        {isDirty && (
                          <Badge variant="warning" size="xs" className="gap-1 animate-pulse shrink-0">
                            <span className="size-1.5 rounded-full bg-amber-400" />
                            <span>Unsaved Changes</span>
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-3.5 sm:p-4 pt-0 space-y-3.5 min-w-0">
                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 pt-0.5">
                        <div className="min-w-0">
                          <label className="text-2xs font-bold text-muted-foreground uppercase block mb-1 truncate">
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
                            <SelectTrigger className="h-8 text-xs bg-background rounded-lg border-border/80 w-full">
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

                        <div className="min-w-0">
                          <label className="text-2xs font-bold text-muted-foreground uppercase block mb-1 truncate">
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
                            <SelectTrigger className="h-8 text-xs bg-background rounded-lg border-border/80 w-full">
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
                      <div className="pt-2 border-t border-border/60 flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-2xs min-w-0">
                          {isDirty ? (
                            <span className="text-brand-text dark:text-amber-300 font-medium truncate">
                              Pending: {getProjectStatusLabel(selectedProject.status)} → {getProjectStatusLabel(draftStatus || selectedProject.status)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-medium flex items-center gap-1 truncate">
                              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="truncate">Status is up to date</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end xs:self-auto shrink-0">
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
                    </CardContent>
                  </Card>

                  {/* Latest Discussion Preview */}
                  {selectedProject.lastMessagePreview && (
                    <Alert
                      variant="warning"
                      className="bg-amber-400/10 border-amber-400/25 py-2.5 px-3 min-w-0"
                    >
                      <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
                      <AlertTitle className="text-xs font-bold text-foreground mb-0.5">
                        Latest Client Message
                      </AlertTitle>
                      <AlertDescription className="text-xs text-foreground/90 leading-relaxed italic break-words">
                        &ldquo;{selectedProject.lastMessagePreview}&rdquo;
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Aesthetic Style & Color Palette */}
                  <ProjectDrawerSpecsCard
                    style={selectedProject.style}
                    colors={selectedProject.colors}
                  />

                  {/* Creative Brief Instructions */}
                  <ProjectDrawerBriefSection
                    instructions={selectedProject.instructions}
                    title="Creative Instructions"
                    showSnapshotBadge
                    redeemCode={selectedProject.redeemCode}
                  />

                  {/* External Reference Links */}
                  <ProjectDrawerLinksSection links={selectedProject.referenceLinks} />

                  {/* Reference Images (Step 4) */}
                  {(selectedProject.uploadedFiles?.length ?? 0) > 0 && (
                    <ReferenceImageGrid
                      files={selectedProject.uploadedFiles}
                      isLoading={Boolean(!detailQuery.data && detailQuery.isFetching)}
                      onSelectImage={(index) => setActiveImageIndex(index)}
                    />
                  )}

                  <Separator className="bg-border/60" />

                  {/* Service Items Breakdown */}
                  <ProjectDrawerServicesSection
                    selections={selectedProject.selections}
                    usedCredits={selectedProject.usedCredits}
                    emptyMessage="Standard package scope"
                  />
                </>
              )}
            </div>
          </ScrollArea>

          {/* Drawer Footer Actions */}
          <SheetFooter className="p-3.5 sm:p-4 border-t border-border/80 bg-secondary/15 flex-row items-center justify-between gap-2.5 sm:gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSelectProject(null)}
              className="h-9 px-3.5 sm:px-4 text-xs font-semibold rounded-lg cursor-pointer shrink-0"
            >
              Close Drawer
            </Button>

            {selectedProject && onOpenChat && (
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={() => {
                  const id = selectedProject.id;
                  handleSelectProject(null);
                  onOpenChat(id);
                }}
                className="h-9 px-3.5 sm:px-4 text-xs font-bold gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20 flex-1 xs:flex-initial justify-center"
              >
                <MessageSquare className="size-3.5 shrink-0" />
                <span className="truncate">Open Client Messages</span>
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
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
        onRetry={async () => {
          await detailQuery.refetch();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Memoized Row & Mobile Card Subcomponents                                   */
/* -------------------------------------------------------------------------- */

const ProjectStatusDotBadge = React.memo(function ProjectStatusDotBadge({
  status,
  className,
}: {
  status: ProjectRecord['status'];
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      size="sm"
      className={cn('gap-1.5 font-medium text-foreground shrink-0', className)}
    >
      <span
        className={cn(
          'size-2 rounded-full shrink-0',
          status === 'pending_review' && 'bg-amber-400 animate-pulse',
          status === 'payment_confirmed' && 'bg-emerald-500',
          status === 'in_production' && 'bg-amber-400 animate-pulse',
          status === 'review_round' && 'bg-purple-500',
          status === 'delivered' && 'bg-emerald-500',
          ![
            'pending_review',
            'payment_confirmed',
            'in_production',
            'review_round',
            'delivered',
          ].includes(status) && 'bg-muted-foreground/50'
        )}
      />
      <span>{getProjectStatusLabel(status)}</span>
    </Badge>
  );
});

interface AdminProjectRowItemProps {
  project: ProjectRecord;
  onSelect: (id: string) => void;
  onOpenChat?: (id: string) => void;
}

const AdminProjectMobileCard = React.memo(function AdminProjectMobileCard({
  project: p,
  onSelect,
  onOpenChat,
}: AdminProjectRowItemProps) {
  return (
    <MobileDataCard onClick={() => onSelect(p.id)}>
      {/* Top Row: Code, Package & Payment Badge */}
      <MobileDataCardHeader>
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Badge
            variant="outline"
            size="sm"
            className="font-mono tabular-nums text-brand-text dark:text-amber-300 bg-amber-400/10 border-amber-400/30 font-bold shrink-0"
          >
            {p.projectCode || p.id.slice(0, 8)}
          </Badge>
          <Badge variant="gold" size="sm" className="font-bold truncate max-w-[180px]">
            {p.packageName || 'Creative Scope'}
          </Badge>
        </div>

        <Badge
          variant={
            p.paymentStatus === 'paid'
              ? 'success'
              : p.paymentStatus === 'refunded'
                ? 'destructive'
                : 'warning'
          }
          size="sm"
          className="shrink-0"
        >
          {getPaymentStatusLabel(p.paymentStatus)}
        </Badge>
      </MobileDataCardHeader>

      {/* Middle Row: Client Identity & Production Status */}
      <MobileDataCardBody>
        <div className="min-w-0">
          <div className="text-xs font-bold text-foreground truncate">
            {p.channelName || p.clientName}
          </div>
          <div className="text-2xs text-muted-foreground truncate">
            {p.channelName && p.clientName && p.channelName !== p.clientName
              ? p.clientName
              : p.email || 'Creator Client'}
          </div>
        </div>

        <ProjectStatusDotBadge status={p.status} className="text-2xs" />
      </MobileDataCardBody>

      {/* Footer: Credits, Timestamp, and Always-Visible Action Buttons */}
      <MobileDataCardFooter>
        <div className="flex items-center justify-between xs:justify-start gap-2.5 text-2xs text-muted-foreground">
          <CreditValue
            value={p.packageCredits || p.usedCredits || 0}
            size="xs"
            variant="pill"
          />
          <span
            className="font-mono tabular-nums flex items-center gap-1"
            title={formatStudioDate(p.createdAt)}
          >
            <Clock className="size-3 text-muted-foreground/70" />
            {formatStudioRelativeTime(p.createdAt)}
          </span>
        </div>

        <MobileDataCardActions>
          {onOpenChat && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat(p.id);
              }}
              className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer justify-center"
            >
              <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
              <span>Chat</span>
            </Button>
          )}
          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p.id);
            }}
            className="h-8 px-3.5 text-xs font-bold gap-1 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20 justify-center"
          >
            <span>Manage</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </MobileDataCardActions>
      </MobileDataCardFooter>
    </MobileDataCard>
  );
});

const AdminProjectTableRow = React.memo(function AdminProjectTableRow({
  project: p,
  onSelect,
  onOpenChat,
}: AdminProjectRowItemProps) {
  return (
    <TableRow
      onClick={() => onSelect(p.id)}
      className="cursor-pointer hover:bg-muted/40 transition-colors"
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
        <div className="min-w-0 max-w-[200px] lg:max-w-[260px]">
          <div className="text-xs font-bold text-foreground truncate">
            {p.channelName || p.clientName}
          </div>
          {p.channelName && p.clientName && p.channelName !== p.clientName && (
            <div className="text-2xs text-muted-foreground truncate">{p.clientName}</div>
          )}
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
        <ProjectStatusDotBadge status={p.status} className="text-xs" />
      </TableCell>

      {/* Payment */}
      <TableCell className="py-3.5 px-4">
        <Badge
          variant={
            p.paymentStatus === 'paid'
              ? 'success'
              : p.paymentStatus === 'refunded'
                ? 'destructive'
                : 'warning'
          }
          size="sm"
        >
          {getPaymentStatusLabel(p.paymentStatus)}
        </Badge>
      </TableCell>

      {/* Credits */}
      <TableCell className="py-3.5 px-4 text-right">
        <CreditValue value={p.packageCredits || p.usedCredits || 0} size="xs" variant="pill" />
      </TableCell>

      {/* Submitted */}
      <TableCell
        className="py-3.5 px-4 text-right text-xs text-muted-foreground font-mono tabular-nums"
        title={formatStudioDate(p.createdAt)}
      >
        {formatStudioRelativeTime(p.createdAt)}
      </TableCell>

      {/* Sticky Actions Column */}
      <TableCell sticky="right" className="py-3.5 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {onOpenChat && (
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat(p.id);
              }}
              title="Open Client Messages"
              aria-label="Open Client Messages"
              className="size-8 rounded-lg border-border text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
            </Button>
          )}
          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p.id);
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
});

