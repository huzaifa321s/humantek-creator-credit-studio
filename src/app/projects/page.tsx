'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ProjectRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import { cn, formatStudioDate } from '@/lib/utils';
import {
  Package,
  Search,
  MessageSquare,
  Sparkles,
  Plus,
  ChevronDown,
  CheckCircle2,
  Loader2,
  FileText,
  Clock,
  Paperclip,
} from 'lucide-react';
import { useStudioChat } from '@/lib/chatStore';
import { ProjectPipelineStepper } from '@/components/ProjectPipelineStepper';
import { ClientProjectDetailsDrawer } from '@/components/projects/ClientProjectDetailsDrawer';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  useInfiniteProjectsQuery,
  useProjectDetailQuery,
} from '@/lib/queries/projects';
import { ChatGate } from '@/components/chat/ChatGate';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';
import { DashboardDraftBanner } from '@/components/DashboardDraftBanner';

function ProjectCardChatButton({ projectId }: { projectId: string }) {
  const { setIsOpen, unreadCounts } = useStudioChat();
  const unread = unreadCounts[projectId] ?? 0;

  return (
    <ChatGate>
      <Button
        data-chat-entry="project-card-chat"
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true, projectId)}
        className="h-8 px-3 text-xs font-medium gap-1.5 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer w-full md:w-auto justify-center"
      >
        <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
        <span>Messages</span>
        {unread > 0 && (
          <Badge
            variant="destructive"
            size="xs"
            className="size-4 p-0 font-bold font-mono tabular-nums text-2xs rounded-full"
          >
            {unread}
          </Badge>
        )}
      </Button>
    </ChatGate>
  );
}

/**
 * Sleek compact expandable row for delivered/older projects.
 * Avoids 500px card bloat while keeping all history and deliverables accessible on 1 click.
 */
function CompactProjectRow({
  project,
  isExpanded,
  onToggle,
  onOpenDetails,
}: {
  project: ProjectRecord;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenDetails: () => void;
}) {
  const detailQuery = useProjectDetailQuery(isExpanded ? project.id : null);
  const effectiveProject = detailQuery.data || project;
  const selections = effectiveProject.selections || [];

  return (
    <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs transition-all hover:border-amber-400/40">
      {/* Clickable Header Row with full Keyboard & Accessibility Support */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`project-details-${project.id}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none bg-card hover:bg-muted/30 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge
            variant="outline"
            size="sm"
            className="font-mono tabular-nums text-brand-text dark:text-amber-300 bg-amber-400/10 border-amber-400/30 font-bold shrink-0"
          >
            {project.projectCode}
          </Badge>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">
              {project.channelName || project.packageName}
            </h3>
            <p className="text-2xs text-muted-foreground truncate">
              {project.packageName} · {formatStudioDate(project.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t border-border/40 sm:border-t-0">
          <Badge variant="success" className="text-2xs font-semibold px-2 py-0.5 rounded-md gap-1">
            <CheckCircle2 className="size-3" />
            <span>Delivered</span>
          </Badge>

          {project.usedCredits > 0 && (
            <CreditValue value={project.usedCredits} size="xs" variant="pill" />
          )}

          <div className="flex items-center gap-1.5 ml-1">
            <div onClick={(e) => e.stopPropagation()}>
              <ProjectCardChatButton projectId={project.id} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground cursor-pointer rounded-md"
              aria-label={isExpanded ? 'Collapse project details' : 'Expand project details'}
              aria-expanded={isExpanded}
              aria-controls={`project-details-${project.id}`}
            >
              <ChevronDown
                className={cn('size-4 transition-transform duration-200', isExpanded && 'rotate-180')}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details Body */}
      {isExpanded && (
        <div
          id={`project-details-${project.id}`}
          className="border-t border-border/60 bg-secondary/15 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200"
        >
          {/* Stepper */}
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Timeline &amp; Milestones
            </p>
            <ProjectPipelineStepper
              status={project.status}
              createdAt={project.createdAt}
              projectCode={project.projectCode}
            />
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/50 text-xs">
            <div>
              <span className="text-muted-foreground text-2xs block font-bold uppercase tracking-wider mb-0.5">
                Aesthetic Style
              </span>
              <b className="font-semibold text-foreground truncate block">
                {project.style || 'Custom Art'}
              </b>
            </div>
            <div>
              <span className="text-muted-foreground text-2xs block font-bold uppercase tracking-wider mb-0.5">
                Color Palette
              </span>
              <b className="font-semibold text-foreground truncate block">
                {project.colors || 'Brand Colors'}
              </b>
            </div>
            <div>
              <span className="text-muted-foreground text-2xs block font-bold uppercase tracking-wider mb-0.5">
                Target Platform
              </span>
              <b className="font-semibold text-foreground truncate block">
                {project.platform || 'General'}
              </b>
            </div>
            <div>
              <span className="text-muted-foreground text-2xs block font-bold uppercase tracking-wider mb-0.5">
                Delivered Date
              </span>
              <b className="font-semibold font-mono tabular-nums text-foreground">
                {formatStudioDate(project.createdAt)}
              </b>
            </div>
          </div>

          {/* Deliverables */}
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Deliverable Assets
              </span>
              <span className="text-2xs text-muted-foreground font-mono">
                {selections.length} items
              </span>
            </div>
            {detailQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-full rounded-md" />
                <Skeleton className="h-7 w-full rounded-md" />
              </div>
            ) : selections.length > 0 ? (
              <div className="divide-y divide-border/50 rounded-lg border border-border/60 bg-card/60 text-xs overflow-hidden">
                {selections.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 gap-2">
                    <span className="font-medium text-foreground truncate">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-semibold text-brand-text dark:text-amber-400 font-mono tabular-nums shrink-0">
                      {item.credits} CR
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-2xs text-muted-foreground">
                All completed package assets delivered directly to studio inbox.
              </p>
            )}
          </div>

          {/* Action Bar */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails();
              }}
              className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer"
            >
              <FileText className="size-3.5 text-brand-text dark:text-amber-400" />
              <span>View details</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get('project');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(urlProjectId);

  useEffect(() => {
    setSelectedProjectId(urlProjectId);
  }, [urlProjectId]);

  const handleSelectProject = useCallback(
    (id: string | null) => {
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
    },
    [router]
  );

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'delivered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const hasAutoSwitchedTab = useRef(false);

  // Debounce search query so server-side search is fast and responsive
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const infiniteQuery = useInfiniteProjectsQuery({
    status: activeTab,
    search: debouncedSearch,
    limit: 20,
    summary: true,
  });

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = infiniteQuery;

  // Flatten projects across all loaded cursor pages
  const allProjects = useMemo(() => {
    return data?.pages.flatMap((page) => page.projects) || [];
  }, [data]);

  const counts = data?.pages[0]?.counts || { all: 0, active: 0, delivered: 0 };
  const totalCount = counts.all;
  const activeCount = counts.active;
  const deliveredCount = counts.delivered;

  const currentTabTotal =
    activeTab === 'active'
      ? activeCount
      : activeTab === 'delivered'
        ? deliveredCount
        : totalCount;

  // If client has 10+ projects, default initial tab to 'active' (In Progress) only if active projects exist.
  // If activeCount === 0 (e.g. all 12 projects are delivered), fall back to 'all' so client is never shown an empty tab.
  useEffect(() => {
    if (!hasAutoSwitchedTab.current && totalCount >= 10) {
      hasAutoSwitchedTab.current = true;
      const target = activeCount > 0 ? 'active' : 'all';
      const timer = setTimeout(() => {
        setActiveTab(target);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [totalCount, activeCount]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={<StudioNewProjectButton />}
    >
      <div className="space-y-6 pb-24 sm:pb-32 animate-in fade-in duration-200">
        {/* Step Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              My Projects
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Track your projects, progress, and deliverables.
            </p>
          </div>
        </div>

        {/* Active Saved Draft Alert Banner */}
        <DashboardDraftBanner />

        {/* Filter Bar with Tabs and Search — only shown when client has more than 3 projects */}
        {totalCount > 3 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FilterTabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as 'all' | 'active' | 'delivered')}
              size="sm"
              tabs={[
                { value: 'all', label: 'All', count: totalCount },
                { value: 'active', label: 'In Progress', count: activeCount },
                { value: 'delivered', label: 'Delivered', count: deliveredCount },
              ]}
            />

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="Search by code, brand, or package..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-card border-border/80 rounded-lg focus-visible:border-amber-400"
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 sm:p-6 rounded-xl border border-border/80 bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-2 w-full rounded-full" />
              </Card>
            ))}
          </div>
        ) : totalCount === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-12 sm:p-14 shadow-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold text-foreground">No projects yet</EmptyTitle>
              <EmptyDescription className="text-muted-foreground text-sm">
                Start your first project to see its progress here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="default"
                className="text-sm font-bold h-10 px-5 gap-2 bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground cursor-pointer shadow-xs shadow-amber-400/20"
                render={<Link href="/new-project" />}
                nativeButton={false}
              >
                <Sparkles className="size-4" />
                Start a project
              </Button>
            </EmptyContent>
          </Empty>
        ) : allProjects.length === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-12 sm:p-14 shadow-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold text-foreground">No matching creative projects found</EmptyTitle>
              <EmptyDescription className="text-muted-foreground text-sm">
                {searchQuery
                  ? `No projects matched "${searchQuery}". Try adjusting your search query or filters.`
                  : 'No projects match the selected filter.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                className="text-sm font-semibold h-9 px-4 cursor-pointer"
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
              >
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-4">
            {allProjects.map((proj) => {
              const isDeliveredOrOlder = proj.status === 'delivered' || proj.status === 'declined' || proj.status === 'cancelled';

              // When client has > 3 projects, render delivered/older projects as sleek compact expandable rows
              if (totalCount > 3 && isDeliveredOrOlder) {
                return (
                  <CompactProjectRow
                    key={proj.id}
                    project={proj}
                    isExpanded={expandedIds.has(proj.id)}
                    onToggle={() => toggleExpanded(proj.id)}
                    onOpenDetails={() => handleSelectProject(proj.id)}
                  />
                );
              }

              // In-progress projects (or all projects when <= 3) render as full cards
              return (
                <Card
                  key={proj.id}
                  className="rounded-xl border border-border/80 bg-card shadow-xs hover:border-amber-400/50 transition-all overflow-hidden"
                >
                  {/* Top Header */}
                  <CardHeader className="p-4 sm:p-5 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="gold" size="sm" className="font-bold">
                          {proj.packageName}
                        </Badge>
                        <Badge variant="outline" size="sm" className="font-mono tabular-nums text-muted-foreground font-semibold">
                          {proj.projectCode}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl sm:text-2xl font-bold text-foreground mt-1.5 tracking-tight break-words">
                        {proj.channelName || proj.packageName}
                      </CardTitle>

                      {/* Client-friendly Status & Context note */}
                      <div className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-start gap-2">
                        <span
                          className={cn(
                            'size-2 rounded-full shrink-0 mt-1 sm:mt-1.5',
                            proj.status === 'pending_review' && 'bg-amber-400 animate-pulse',
                            proj.status === 'payment_confirmed' && 'bg-emerald-500',
                            proj.status === 'in_production' && 'bg-amber-400 animate-pulse',
                            proj.status === 'review_round' && 'bg-purple-500',
                            proj.status === 'delivered' && 'bg-emerald-500',
                            !['pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered'].includes(proj.status) && 'bg-muted-foreground/50'
                          )}
                        />
                        <p className="min-w-0 flex-1 leading-snug">
                          <span className="font-semibold text-foreground/90">
                            {proj.status === 'pending_review'
                              ? 'Pending Studio Review'
                              : proj.status === 'payment_confirmed'
                              ? 'Payment Confirmed'
                              : proj.status === 'in_production'
                              ? 'In Production'
                              : proj.status === 'review_round'
                              ? 'Review Round Open'
                              : proj.status === 'delivered'
                              ? 'Delivered'
                              : `Project ${proj.status.replace(/_/g, ' ')}`}
                          </span>
                          <span className="text-muted-foreground">
                            {proj.status === 'pending_review'
                              ? ' · Studio team is reviewing your project'
                              : proj.status === 'payment_confirmed'
                              ? ' · Queued for production'
                              : proj.status === 'in_production'
                              ? ' · Artists are working on your assets'
                              : proj.status === 'review_round'
                              ? ' · Draft ready for your review'
                              : proj.status === 'delivered'
                              ? ' · Files delivered'
                              : ''}
                          </span>
                          {proj.platform && proj.platform.toLowerCase() !== 'general' && (
                            <span className="text-muted-foreground">
                              {' '}· Platform: <b className="text-foreground font-semibold">{proj.platform}</b>
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between md:justify-end md:flex-col md:items-end gap-2 pt-2 md:pt-0 border-t border-border/40 md:border-t-0 shrink-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={
                            proj.paymentStatus === 'paid'
                              ? 'success'
                              : proj.status === 'pending_review'
                              ? 'gold'
                              : 'secondary'
                          }
                          className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-md"
                        >
                          {proj.paymentStatus === 'paid'
                            ? 'Payment Confirmed'
                            : proj.status === 'pending_review'
                            ? 'Pending Review'
                            : 'Awaiting Payment'}
                        </Badge>
                        {proj.usedCredits > 0 && (
                          <div className="flex items-center gap-1.5">
                            <CreditValue value={proj.usedCredits} size="sm" variant="pill" />
                            <span className="text-xs text-muted-foreground font-semibold hidden min-[440px]:inline">used</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center md:justify-end gap-2 w-full md:w-auto">
                        <ProjectCardChatButton projectId={proj.id} />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectProject(proj.id)}
                          className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer w-full md:w-auto justify-center"
                        >
                          <FileText className="size-3.5 text-brand-text dark:text-amber-400" />
                          <span>View details</span>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {/* 6-Stage Project Progress Stepper */}
                    <div className="p-4 sm:p-6 bg-secondary/25">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                        Project Progress
                      </p>
                      <ProjectPipelineStepper
                        status={proj.status}
                        createdAt={proj.createdAt}
                        projectCode={proj.projectCode}
                      />
                    </div>

                    {/* What Happens Next status line & indicators */}
                    <div className="px-4 sm:px-6 py-2.5 bg-muted/20 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
                        <p className="text-muted-foreground truncate">
                          <b className="text-foreground font-semibold">Next step:</b>{' '}
                          {proj.status === 'pending_review' && 'Studio lead review in progress (expected 2–4h)'}
                          {proj.status === 'payment_confirmed' && 'Queued for artist assignment'}
                          {proj.status === 'in_production' && 'Draft concepts in illustration and rendering'}
                          {proj.status === 'review_round' && 'Review your draft assets and share feedback'}
                          {proj.status === 'delivered' && 'All final project files completed and delivered'}
                          {!['pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered'].includes(proj.status) && 'Project update will appear here'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {proj.uploadedFiles && proj.uploadedFiles.length > 0 && (
                          <span className="flex items-center gap-1 font-mono text-2xs text-muted-foreground" title={`${proj.uploadedFiles.length} reference images attached`}>
                            <Paperclip className="size-3 text-brand-text dark:text-amber-400" />
                            <span>{proj.uploadedFiles.length} refs</span>
                          </span>
                        )}
                        {proj.additions && proj.additions.some((a: string) => /rush|express|24h/i.test(a)) && (
                          <span className="flex items-center gap-1 text-2xs text-amber-500 font-semibold" title="Express turnaround">
                            <Sparkles className="size-3" />
                            <span>Express</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Summary Details */}
                    <div className={cn(
                      'p-4 sm:p-6 grid gap-3 sm:gap-4 border-t border-border/60',
                      proj.platform && proj.platform.toLowerCase() !== 'general'
                        ? 'grid-cols-2 sm:grid-cols-4'
                        : 'grid-cols-1 sm:grid-cols-3'
                    )}>
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-2xs sm:text-xs block font-bold uppercase tracking-wider mb-1">Aesthetic Style</span>
                        <b className="text-xs sm:text-sm font-semibold text-foreground truncate block">{proj.style || 'Custom Art'}</b>
                      </div>
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-2xs sm:text-xs block font-bold uppercase tracking-wider mb-1">Color Palette</span>
                        <b className="text-xs sm:text-sm font-semibold text-foreground truncate block">{proj.colors || 'Brand Colors'}</b>
                      </div>
                      {proj.platform && proj.platform.toLowerCase() !== 'general' && (
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-2xs sm:text-xs block font-bold uppercase tracking-wider mb-1">Target Platform</span>
                          <b className="text-xs sm:text-sm font-semibold text-foreground truncate block">{proj.platform}</b>
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-2xs sm:text-xs block font-bold uppercase tracking-wider mb-1">Submitted Date</span>
                        <b className="text-xs sm:text-sm font-semibold font-mono tabular-nums text-foreground">
                          {formatStudioDate(proj.createdAt)}
                        </b>
                      </div>
                    </div>

                    {/* Deliverable Assets List */}
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-border/60 pt-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Deliverable Assets</span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">{(proj.selections || []).length} items</span>
                      </div>
                      {(proj.selections || []).length > 0 ? (
                        <div className="divide-y divide-border/50 rounded-lg border border-border/60 bg-muted/20 text-xs overflow-hidden">
                          {(proj.selections || []).map((item, i) => (
                            <div key={i} className="flex items-center justify-between px-3.5 py-2 hover:bg-muted/40 transition-colors gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium text-foreground truncate">{item.name}</span>
                                <span className="text-muted-foreground font-mono tabular-nums shrink-0">× {item.quantity}</span>
                              </div>
                              <span className="font-semibold text-brand-text dark:text-amber-400 font-mono tabular-nums shrink-0">{item.credits} CR</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg border border-dashed border-border/70 bg-muted/10 text-xs text-muted-foreground flex items-center justify-between">
                          <span>We’ll finalize the exact deliverables together during the brief review.</span>
                          <span className="font-mono text-2xs text-muted-foreground/60">Awaiting Brief</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Load More Button for Keyset Cursor pagination (No page numbers) */}
            {(hasNextPage || currentTabTotal > 20) && (
              <div className="pt-4 flex flex-col items-center gap-2">
                <p className="text-2xs text-muted-foreground font-medium" aria-live="polite">
                  Loaded {allProjects.length} of {currentTabTotal} projects
                </p>
                {hasNextPage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                    className="h-9 px-5 text-xs font-semibold gap-2 border-border/80 bg-card hover:bg-muted cursor-pointer"
                    aria-label={`Load more projects. Currently loaded ${allProjects.length} of ${currentTabTotal}`}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Loading more projects...</span>
                      </>
                    ) : (
                      <span>Load More Projects</span>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* URL-Addressable Client Project Details Drawer */}
      <ClientProjectDetailsDrawer
        projectId={selectedProjectId}
        onClose={() => handleSelectProject(null)}
      />
    </StudioCardLayout>
  );
}
