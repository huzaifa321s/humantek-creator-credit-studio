'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Search,
  Plus,
  X,
  Inbox,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { cn, formatChatTimestamp, getProjectStatusLabel } from '@/lib/utils';
import { ChatMessage, GLOBAL_CHAT_ID } from '@/lib/chatStore';
import { useInfiniteProjectsQuery } from '@/lib/queries/projects';
import { useUserStore } from '@/lib/userStore';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

/** Sessions fetched per cursor page. Small enough for a fast first paint, large enough to fill the panel. */
const SESSIONS_PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 250;

interface SidebarProject {
  id: string;
  projectCode: string;
  packageName: string;
  clientName: string;
  channelName?: string;
  status: string;
  packagePrice?: number;
  packageCredits?: number;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
}

export interface ChatProjectSidebarProps {
  /**
   * Projects already known to the parent (first page from the shared projects cache).
   * Used only to pin sessions with unread messages; the list itself is paginated internally.
   */
  projects: SidebarProject[];
  activeProjectId: string;
  unreadCounts: Record<string, number>;
  projectMessages?: Record<string, ChatMessage[]>;
  onSelectProject: (projectId: string) => void;
  onNewBriefClick?: () => void;
  onNewProjectClick?: () => void;
  viewerRole?: 'client' | 'admin';
  className?: string;
}

type FilterTab = 'all' | 'active' | 'unread';

const INACTIVE_STATUSES = new Set(['delivered', 'declined', 'cancelled']);

function matchesSearch(p: SidebarProject, q: string) {
  if (!q) return true;
  return (
    p.projectCode.toLowerCase().includes(q) ||
    p.clientName.toLowerCase().includes(q) ||
    (p.channelName && p.channelName.toLowerCase().includes(q)) ||
    p.packageName.toLowerCase().includes(q)
  );
}

function SessionSkeleton() {
  return (
    <div className="p-2.5 rounded-lg border border-border/60 bg-card/60 space-y-2 shadow-2xs min-h-[52px]">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-20 rounded-md" />
        <Skeleton className="h-3 w-12 rounded-full" />
      </div>
      <Skeleton className="h-3 w-28 rounded-md" />
      <Skeleton className="h-3 w-36 rounded-md" />
    </div>
  );
}

export function ChatProjectSidebar({
  projects,
  activeProjectId,
  unreadCounts,
  onSelectProject,
  onNewBriefClick,
  onNewProjectClick,
  viewerRole = 'client',
  className,
}: ChatProjectSidebarProps) {
  const { user } = useUserStore();
  const handleNewProject = onNewProjectClick || onNewBriefClick;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search so we query the server, not just the loaded page
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const isGlobalSelected = activeProjectId === GLOBAL_CHAT_ID;
  const globalUnread = unreadCounts[GLOBAL_CHAT_ID] || 0;
  const lastGlobalPreview = 'Questions about packages, credits, or custom ideas';

  const totalProjectUnread = useMemo(() => {
    return Object.entries(unreadCounts).reduce((acc, [id, count]) => {
      if (id === GLOBAL_CHAT_ID) return acc;
      return acc + count;
    }, 0);
  }, [unreadCounts]);

  // Cursor-paginated sessions (server-side status + search filtering)
  const sessionsQuery = useInfiniteProjectsQuery({
    status: activeTab === 'active' ? 'active' : 'all',
    search: debouncedSearch,
    limit: SESSIONS_PAGE_SIZE,
    summary: true,
  });
  const {
    data,
    isPending: isInitialLoading,
    isError: isInitialError,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = sessionsQuery;

  const loadedSessions = useMemo<SidebarProject[]>(
    () => data?.pages.flatMap((page) => page.projects) ?? [],
    [data]
  );

  const totalSessions = data?.pages[0]?.counts.all ?? projects.length;
  const isSearching = searchQuery.trim() !== debouncedSearch;

  // Pin sessions with unread messages so new studio replies are never buried on a later page
  const pinnedUnread = useMemo(() => {
    const byId = new Map<string, SidebarProject>();
    [...projects, ...loadedSessions].forEach((p) => {
      if ((unreadCounts[p.id] || 0) > 0 && !byId.has(p.id)) byId.set(p.id, p);
    });
    const q = debouncedSearch.toLowerCase();
    return Array.from(byId.values()).filter(
      (p) =>
        matchesSearch(p, q) &&
        (activeTab !== 'active' || !INACTIVE_STATUSES.has(p.status))
    );
  }, [projects, loadedSessions, unreadCounts, debouncedSearch, activeTab]);

  const pinnedIds = useMemo(() => new Set(pinnedUnread.map((p) => p.id)), [pinnedUnread]);

  const listedSessions = useMemo(
    () => (activeTab === 'unread' ? [] : loadedSessions.filter((p) => !pinnedIds.has(p.id))),
    [activeTab, loadedSessions, pinnedIds]
  );

  const visibleCount = pinnedUnread.length + listedSessions.length;
  const canPaginate = activeTab !== 'unread' && !!hasNextPage;

  // Infinite scroll: fetch the next cursor page when the sentinel nears the bottom of the panel
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !canPaginate) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage && !isFetchNextPageError) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: '0px 0px 120px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [canPaginate, isFetchingNextPage, isFetchNextPageError, fetchNextPage, visibleCount]);

  // Reset scroll to top when the filter or search changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab, debouncedSearch]);

  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setActiveTab('all');
  };

  const renderSession = (p: SidebarProject) => {
    const isSelected = p.id === activeProjectId;
    const pUnread = unreadCounts[p.id] || 0;
    const lastPreview = p.lastMessagePreview?.trim() || 'No messages yet';

    // Primary title on Line 1:
    // If the creator gave a Channel / Brand name (e.g. "Jakeem Herrera", "PixelGamer"), honor it directly!
    // If no channel name was provided, fall back to Package Name + Order Number (e.g. "Creator Forge #1238").
    const rawChannel = p.channelName?.trim() || '';
    const hasChannelName = Boolean(rawChannel);

    // Extract short numeric order ID (e.g. "#2562" from "HT-2562-MOMENTUM")
    const codeDigits = p.projectCode.match(/\d+/);
    const orderNumber = codeDigits ? `#${codeDigits[0]}` : p.projectCode;

    // Compact code for Line 2 when accompanied by secondary package text (e.g. "HT-2562" instead of "HT-2562-MOMENTUM")
    const shortCode = p.projectCode.split('-').slice(0, 2).join('-');

    const displayTitle = hasChannelName
      ? rawChannel
      : viewerRole === 'admin' && p.clientName
      ? p.clientName
      : p.packageName
      ? `${p.packageName} ${orderNumber}`
      : `Project ${orderNumber}`;

    // Secondary detail on Line 2:
    // If Line 1 is the Channel Name, show the Package Name on Line 2.
    // If Line 1 is already the Package Name, leave Line 2 clean.
    const secondaryDetail = hasChannelName
      ? viewerRole === 'admin' && p.clientName
        ? p.clientName
        : p.packageName
      : viewerRole === 'admin'
      ? p.packageName
      : '';

    const statusLabel = getProjectStatusLabel(p.status);
    const getStatusStyle = (status: string) => {
      switch (status) {
        case 'payment_confirmed':
        case 'delivered':
          return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
        case 'in_production':
          return 'text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/25';
        case 'declined':
        case 'cancelled':
          return 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25';
        default:
          return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25';
      }
    };

    return (
      <SidebarMenuItem key={p.id}>
        <SidebarMenuButton
          isActive={isSelected}
          onClick={() => onSelectProject(p.id)}
          className={cn(
            'group/project-item cursor-pointer py-2 px-2.5 h-auto min-h-[56px] rounded-lg transition-all border flex flex-col items-stretch text-left relative overflow-hidden',
            isSelected
              ? 'border-amber-400/80 bg-amber-400/10 shadow-xs ring-1 ring-amber-400/30'
              : 'border-border/70 bg-card/60 hover:border-amber-400/50 hover:bg-secondary/40'
          )}
        >
          {/* Left active accent bar indicator */}
          {isSelected && (
            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r-xs" />
          )}

          {/* Line 1: Channel / Project Title + Status or Unread */}
          <div className="flex items-center justify-between gap-1 mb-0.5 w-full">
            <span
              className={cn(
                'text-xs font-bold tracking-tight truncate',
                isSelected ? 'text-brand-text dark:text-amber-300' : 'text-foreground'
              )}
            >
              {displayTitle}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {pUnread > 0 ? (
                <Badge
                  variant="destructive"
                  className="text-2xs font-mono font-bold tabular-nums px-1.5 py-0 h-4 shrink-0 animate-pulse"
                >
                  {pUnread} new
                </Badge>
              ) : (
                <span
                  className={cn(
                    'text-3xs font-medium px-1.5 py-0.2 rounded-md border shrink-0 inline-flex items-center leading-normal',
                    getStatusStyle(p.status)
                  )}
                >
                  {statusLabel}
                </span>
              )}
            </div>
          </div>

          {/* Line 2: Monospace Code Pill + Client/Package tag + Time */}
          <div className="flex items-center justify-between text-2xs text-muted-foreground mb-1 w-full gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-3xs text-brand-text dark:text-amber-300 bg-amber-400/10 dark:bg-amber-400/15 px-1 py-0.2 rounded border border-amber-400/25 shrink-0 font-semibold">
                {secondaryDetail ? shortCode : p.projectCode}
              </span>
              {secondaryDetail && (
                <span className="text-3xs text-muted-foreground truncate">
                  {secondaryDetail}
                </span>
              )}
            </div>
            <span className="text-3xs shrink-0 font-mono tabular-nums text-muted-foreground/80">
              {p.lastMessageAt ? formatChatTimestamp(p.lastMessageAt) : ''}
            </span>
          </div>

          {/* Line 3: Snippet */}
          <p
            className={cn(
              'text-2xs line-clamp-1 leading-relaxed w-full break-words text-muted-foreground/80',
              pUnread > 0 && 'font-medium text-foreground dark:text-amber-200',
              lastPreview === 'No messages yet' && 'italic text-muted-foreground/60'
            )}
          >
            {lastPreview}
          </p>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <div className={cn('flex flex-col h-full bg-secondary/15', className)}>
      {/* ========================================================= */}
      {/* 1. PINNED GLOBAL CHAT (Always at the very top)            */}
      {/* ========================================================= */}
      <div className="p-2 border-b border-border/70 shrink-0 bg-background/60 backdrop-blur-xs">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isGlobalSelected}
              onClick={() => onSelectProject(GLOBAL_CHAT_ID)}
              className={cn(
                'group/global-item cursor-pointer px-2.5 py-2 h-auto rounded-lg transition-all border flex flex-col items-stretch text-left relative overflow-hidden',
                isGlobalSelected
                  ? 'border-amber-400 bg-amber-400/15 dark:bg-amber-400/25 shadow-xs ring-1 ring-amber-400/40'
                  : 'border-amber-400/30 dark:border-amber-400/35 bg-amber-400/[0.06] dark:bg-amber-400/[0.10] hover:bg-amber-400/12 hover:border-amber-400/50 shadow-2xs'
              )}
            >
              {isGlobalSelected && (
                <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r-xs" />
              )}

              {/* Row 1: Icon + Title on left, Badge or Status on right */}
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md transition-all shadow-2xs',
                      isGlobalSelected
                        ? 'bg-amber-400 text-zinc-950 font-black shadow-amber-400/20'
                        : 'bg-amber-400/20 text-brand-text dark:text-amber-300'
                    )}
                  >
                    <MessageSquare className="size-3" />
                  </span>
                  <span
                    className={cn(
                      'text-xs font-bold tracking-tight truncate',
                      isGlobalSelected
                        ? 'text-brand-text dark:text-amber-200'
                        : 'text-foreground'
                    )}
                  >
                    {viewerRole === 'admin' ? 'General Inquiries' : 'Ask the Studio Team'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {globalUnread > 0 ? (
                    <Badge
                      variant="destructive"
                      className="text-2xs font-mono font-bold tabular-nums px-1.5 py-0 h-4 shrink-0 animate-pulse"
                    >
                      {globalUnread} new
                    </Badge>
                  ) : viewerRole === 'admin' ? (
                    <Badge
                      variant="outline"
                      className="text-3xs font-medium px-1.5 py-0 h-4 border-amber-400/30 text-brand-text dark:text-amber-300 bg-amber-400/10 rounded-md"
                    >
                      General
                    </Badge>
                  ) : (
                    <span className="text-3xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Clean Subtitle / Last Message */}
              <p
                className={cn(
                  'text-2xs truncate pl-6.5 w-full mt-0.5 leading-relaxed',
                  globalUnread > 0
                    ? 'font-medium text-foreground dark:text-amber-200'
                    : 'text-muted-foreground'
                )}
              >
                {viewerRole === 'admin'
                  ? 'General questions and pre-order inquiries'
                  : 'Questions about packages, credits, or custom ideas'}
              </p>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      {/* ========================================================= */}
      {/* 2. PROJECTS SECTION HEADER & CONTROLS                     */}
      {/* ========================================================= */}
      <div className="p-2 pb-1.5 border-b border-border/70 space-y-1.5 shrink-0 bg-background/40 mb-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex size-4 items-center justify-center rounded-md bg-amber-400/15 text-brand-text dark:text-amber-400">
              <FolderKanban className="size-3" />
            </span>
            <span className="text-2xs font-bold tracking-wider uppercase text-muted-foreground/80">
              {viewerRole === 'admin' ? 'CLIENT PROJECTS' : 'MY PROJECTS'}
            </span>
            <Badge variant="outline" className="text-2xs font-mono tabular-nums h-4 px-1.5 font-semibold text-muted-foreground">
              {totalSessions}
            </Badge>
          </div>

          {viewerRole === 'admin' ? (
            <Link href="/management/projects">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 px-1.5 text-2xs font-semibold gap-1 text-brand-text dark:text-amber-400 hover:bg-amber-400/15 rounded-md cursor-pointer"
              >
                <FolderKanban className="size-3" />
                <span>All Projects</span>
              </Button>
            </Link>
          ) : (
            <Link href="/new-project" onClick={handleNewProject}>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 px-1.5 text-2xs font-semibold gap-1 text-brand-text dark:text-amber-400 hover:bg-amber-400/15 rounded-md cursor-pointer"
              >
                <Plus className="size-3" />
                <span>New Project</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Search input with clear button */}
        <div className="relative">
          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder={viewerRole === 'admin' ? 'Search projects or clients...' : 'Search projects...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7.5 pl-7 pr-6 text-xs bg-card/90 rounded-md border-border/70 focus-visible:border-amber-400 placeholder:text-muted-foreground/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Reusable Project Tabs (Consistent with whole project design system) */}
        <FilterTabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as FilterTab)}
          size="sm"
          className="w-full"
          listClassName="w-full grid grid-cols-3"
          tabs={[
            { value: 'all', label: 'All', count: totalSessions },
            { value: 'active', label: 'Active', count: data?.pages[0]?.counts.active },
            {
              value: 'unread',
              label: 'Unread',
              count: totalProjectUnread > 0 ? totalProjectUnread : undefined,
            },
          ]}
        />
      </div>

      {/* ========================================================= */}
      {/* 3. PROJECT SESSIONS LIST (cursor-paginated, infinite scroll) */}
      {/* ========================================================= */}
      <ScrollArea ref={scrollRef} className="flex-1 p-1.5 scrollbar-custom" aria-busy={isInitialLoading || isFetchingNextPage}>
        {isInitialLoading && visibleCount === 0 && activeTab !== 'unread' ? (
          <div className="space-y-2 p-1" role="status" aria-label="Loading projects">
            {[1, 2, 3, 4].map((i) => (
              <SessionSkeleton key={i} />
            ))}
          </div>
        ) : isInitialError && visibleCount === 0 && activeTab !== 'unread' ? (
          <Empty className="py-6 border-0">
            <EmptyHeader>
              <EmptyTitle className="text-xs font-semibold tracking-tight">Couldn&apos;t load projects</EmptyTitle>
              <EmptyDescription className="text-2xs text-muted-foreground leading-normal">
                Check your connection and try again.
              </EmptyDescription>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void refetch()}
                className="mt-1.5 h-7 gap-1 text-2xs font-semibold"
              >
                <RotateCcw className="size-3" />
                Retry
              </Button>
            </EmptyHeader>
          </Empty>
        ) : totalSessions === 0 && !debouncedSearch && activeTab === 'all' ? (
          <Empty className="py-6 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-amber-400/15 text-brand-text dark:text-amber-400 size-8">
                <FolderKanban className="size-4" />
              </EmptyMedia>
              <EmptyTitle className="text-xs font-semibold tracking-tight">
                {viewerRole === 'admin' ? 'No active project chats' : 'No projects yet'}
              </EmptyTitle>
              <EmptyDescription className="text-2xs text-muted-foreground leading-normal">
                {viewerRole === 'admin'
                  ? 'Client project chats will appear here once submitted.'
                  : 'Start a project to open a dedicated workspace.'}
              </EmptyDescription>
              {viewerRole !== 'admin' && (
                <Link href="/new-project" onClick={handleNewProject} className="mt-1.5">
                  <Button type="button" variant="outline" size="xs" className="h-7 gap-1 text-2xs font-semibold">
                    <Plus className="size-3" />
                    <span>+ New Project</span>
                  </Button>
                </Link>
              )}
            </EmptyHeader>
          </Empty>
        ) : visibleCount === 0 ? (
          <Empty className="py-6 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-amber-400/15 text-brand-text dark:text-amber-400 size-8">
                <Inbox className="size-4" />
              </EmptyMedia>
              <EmptyTitle className="text-xs font-semibold tracking-tight">
                {activeTab === 'unread' && !debouncedSearch
                  ? 'All caught up'
                  : viewerRole === 'admin'
                  ? 'No project chats found'
                  : 'No projects found'}
              </EmptyTitle>
              <EmptyDescription className="text-2xs text-muted-foreground leading-normal">
                {debouncedSearch
                  ? `No results for "${debouncedSearch}"`
                  : activeTab === 'unread'
                    ? viewerRole === 'admin'
                      ? 'No unread client messages right now.'
                      : 'No unread messages right now.'
                    : 'No projects found in this category'}
              </EmptyDescription>
              {(debouncedSearch || activeTab !== 'all') && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={clearFilters}
                  className="mt-1.5 h-7 text-2xs font-semibold"
                >
                  Clear Filters
                </Button>
              )}
            </EmptyHeader>
          </Empty>
        ) : (
          <div className={cn('space-y-1 transition-opacity', isSearching && 'opacity-60')}>
            {/* Pinned: sessions with unread messages */}
            {pinnedUnread.length > 0 && (
              <>
                {activeTab !== 'unread' && listedSessions.length > 0 && (
                  <p className="px-1 pt-0.5 text-3xs font-bold uppercase tracking-wider text-muted-foreground/80">
                    {viewerRole === 'admin' ? `Unread Client Messages (${pinnedUnread.length})` : 'Unread'}
                  </p>
                )}
                <SidebarMenu className="gap-1 space-y-1">{pinnedUnread.map(renderSession)}</SidebarMenu>
              </>
            )}

            {/* Paginated sessions */}
            {listedSessions.length > 0 && (
              <>
                {pinnedUnread.length > 0 && (
                  <p className="px-1 pt-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground/80">
                    {activeTab === 'active' ? 'Active' : 'All projects'}
                  </p>
                )}
                <SidebarMenu className="gap-1 space-y-1">{listedSessions.map(renderSession)}</SidebarMenu>
              </>
            )}

            {/* Bottom shimmer skeletons while the next cursor page loads */}
            {isFetchingNextPage && (
              <div className="space-y-1 pt-1" role="status" aria-label="Loading more projects">
                <SessionSkeleton />
                <SessionSkeleton />
              </div>
            )}

            {/* Inline retry if a page fails, instead of silently stopping */}
            {isFetchNextPageError && !isFetchingNextPage && (
              <div className="flex items-center justify-center gap-2 py-2 text-2xs text-muted-foreground">
                <span>Couldn&apos;t load more.</span>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => void fetchNextPage()}
                  className="h-auto p-0 text-2xs font-semibold text-brand-text dark:text-amber-400"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Scroll sentinel: observed to trigger the next page */}
            {canPaginate && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}

            {/* End-of-list marker (only once the user has actually paginated) */}
            {activeTab !== 'unread' && !hasNextPage && (data?.pages.length ?? 0) > 1 && (
              <p className="py-2 text-center text-3xs text-muted-foreground/70">No more projects</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

