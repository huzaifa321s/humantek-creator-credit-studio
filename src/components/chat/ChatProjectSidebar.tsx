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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  lastChatBy?: string | null;
}

export interface GeneralInquiryThread {
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  clientAvatarUrl?: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  messageCount: number;
  projectCount?: number;
  lastChatBy?: string | null;
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
  inquiryThreads?: GeneralInquiryThread[];
  activeInquiryClientId?: string | null;
  onSelectInquiryClient?: (clientId: string) => void;
  isInquiriesLoading?: boolean;
  className?: string;
}

type FilterTab = 'all' | 'active' | 'unread';
type AdminSidebarMode = 'projects' | 'inquiries';
type InquiryFilterTab = 'all' | 'unread';

const INACTIVE_STATUSES = new Set(['delivered', 'declined', 'cancelled']);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function matchesSearch(p: SidebarProject, q: string) {
  if (!q) return true;
  return (
    p.projectCode.toLowerCase().includes(q) ||
    p.clientName.toLowerCase().includes(q) ||
    (p.channelName && p.channelName.toLowerCase().includes(q)) ||
    p.packageName.toLowerCase().includes(q) ||
    (p.lastChatBy && p.lastChatBy.toLowerCase().includes(q))
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
  inquiryThreads = [],
  activeInquiryClientId = null,
  onSelectInquiryClient,
  isInquiriesLoading = false,
  className,
}: ChatProjectSidebarProps) {
  const { user } = useUserStore();
  const handleNewProject = onNewProjectClick || onNewBriefClick;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [inquiryTab, setInquiryTab] = useState<InquiryFilterTab>('all');

  const isGlobalSelected = activeProjectId === GLOBAL_CHAT_ID;
  const [adminMode, setAdminMode] = useState<AdminSidebarMode>(() =>
    isGlobalSelected ? 'inquiries' : 'projects'
  );
  const [prevGlobalSelected, setPrevGlobalSelected] = useState(isGlobalSelected);
  if (prevGlobalSelected !== isGlobalSelected) {
    setPrevGlobalSelected(isGlobalSelected);
    setAdminMode(isGlobalSelected ? 'inquiries' : 'projects');
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search so we query the server, not just the loaded page
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const globalUnread = unreadCounts[GLOBAL_CHAT_ID] || 0;
  const totalInquiryUnread = useMemo(() => {
    const fromThreads = inquiryThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
    return Math.max(globalUnread, fromThreads);
  }, [inquiryThreads, globalUnread]);

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
        case 'declined':
        case 'cancelled':
          return 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25';
        case 'in_production':
        case 'review_round':
        default:
          return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25';
      }
    };

    const titleTooltipLabel = hasChannelName
      ? 'Channel / Brand'
      : viewerRole === 'admin' && p.clientName
        ? 'Client'
        : 'Package';

    return (
      <SidebarMenuItem key={p.id}>
        <SidebarMenuButton
          isActive={isSelected}
          onClick={() => onSelectProject(p.id)}
          className={cn(
            'group/project-item cursor-pointer py-2 px-2.5 h-auto min-h-[56px] rounded-lg transition-all border flex flex-col items-stretch text-left relative overflow-hidden',
            isSelected
              ? 'border-amber-400/80 bg-amber-400/[0.08] data-active:bg-amber-400/[0.08] hover:bg-amber-400/[0.12] data-active:text-foreground shadow-xs ring-1 ring-amber-400/25'
              : 'border-border/80 bg-card/85 hover:border-amber-400/45 hover:bg-amber-400/[0.04]'
          )}
        >
          {/* Left active accent bar indicator */}
          {isSelected && (
            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r-xs" />
          )}

          {/* Line 1: Channel / Project Title + Status or Unread */}
          <div className="flex items-center justify-between gap-1 mb-0.5 w-full">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      'text-xs font-bold tracking-tight truncate',
                      isSelected ? 'text-brand-text dark:text-amber-300' : 'text-foreground'
                    )}
                  />
                }
              >
                {displayTitle}
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="px-2.5 py-1.5 text-2xs">
                <span>
                  <span className="text-zinc-400 font-medium">{titleTooltipLabel}:</span>{' '}
                  <span className="font-semibold text-white">{displayTitle}</span>
                </span>
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1 shrink-0">
              {pUnread > 0 ? (
                <Badge
                  variant="gold-solid"
                  className="text-2xs font-mono font-black tabular-nums px-1.5 py-0 h-4 shrink-0 animate-pulse"
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
              <span className="font-mono text-3xs text-foreground/85 bg-secondary/75 dark:bg-secondary/60 px-1.5 py-0.2 rounded border border-border/80 shrink-0 font-semibold">
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

          {/* Line 4: Last chat by (Owner/Manager Name) for Studio Management roles */}
          {viewerRole === 'admin' && p.lastChatBy && (
            <div className="mt-1 flex items-center gap-1 text-3xs text-muted-foreground truncate">
              <MessageSquare className="size-2.5 text-amber-500/80 shrink-0" />
              <span className="truncate">
                Last chat by{' '}
                <span className="font-semibold text-foreground/90">
                  ({p.lastChatBy})
                </span>
              </span>
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const filteredInquiryThreads = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return inquiryThreads.filter((t) => {
      if (inquiryTab === 'unread' && t.unreadCount <= 0) return false;
      if (!q) return true;
      return (
        t.clientName.toLowerCase().includes(q) ||
        (t.clientEmail && t.clientEmail.toLowerCase().includes(q)) ||
        t.lastMessagePreview.toLowerCase().includes(q) ||
        (t.lastChatBy && t.lastChatBy.toLowerCase().includes(q))
      );
    });
  }, [inquiryThreads, inquiryTab, debouncedSearch]);

  const pinnedUnreadInquiries = useMemo(
    () => filteredInquiryThreads.filter((t) => t.unreadCount > 0),
    [filteredInquiryThreads]
  );

  const listedInquiries = useMemo(
    () =>
      inquiryTab === 'unread'
        ? []
        : filteredInquiryThreads.filter((t) => t.unreadCount <= 0),
    [filteredInquiryThreads, inquiryTab]
  );

  const renderInquiryThread = (t: GeneralInquiryThread) => {
    const isSelected = isGlobalSelected && activeInquiryClientId === t.clientId;
    const hasUnread = t.unreadCount > 0;
    const initials = getInitials(t.clientName);

    return (
      <SidebarMenuItem key={t.clientId}>
        <SidebarMenuButton
          isActive={isSelected}
          onClick={() => {
            if (!isGlobalSelected) {
              onSelectProject(GLOBAL_CHAT_ID);
            }
            onSelectInquiryClient?.(t.clientId);
          }}
          className={cn(
            'group/inquiry-item cursor-pointer py-2 px-2.5 h-auto min-h-[58px] rounded-lg transition-all border flex flex-col items-stretch text-left relative overflow-hidden',
            isSelected
              ? 'border-amber-400/80 bg-amber-400/[0.08] data-active:bg-amber-400/[0.08] hover:bg-amber-400/[0.12] data-active:text-foreground shadow-xs ring-1 ring-amber-400/25'
              : 'border-border/80 bg-card/85 hover:border-amber-400/45 hover:bg-amber-400/[0.04]'
          )}
        >
          {isSelected && (
            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r-xs" />
          )}

          {/* Row 1: Client Avatar + Client Name + Unread or General Badge */}
          <div className="flex items-center justify-between gap-1.5 mb-0.5 w-full">
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar
                className={cn(
                  'size-5 shrink-0 rounded-full border transition-all',
                  isSelected
                    ? 'border-amber-400 ring-1 ring-amber-400/40'
                    : 'border-amber-400/25'
                )}
              >
                {t.clientAvatarUrl && (
                  <AvatarImage
                    src={t.clientAvatarUrl}
                    alt={t.clientName}
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback
                  className={cn(
                    'text-3xs font-bold tracking-tight',
                    isSelected
                      ? 'bg-amber-400 text-zinc-950'
                      : 'bg-amber-400/15 text-brand-text dark:text-amber-300'
                  )}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  'text-xs font-bold tracking-tight truncate',
                  isSelected ? 'text-brand-text dark:text-amber-300' : 'text-foreground'
                )}
              >
                {t.clientName}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {hasUnread ? (
                <Badge
                  variant="gold-solid"
                  className="text-2xs font-mono font-black tabular-nums px-1.5 py-0 h-4 shrink-0 animate-pulse"
                >
                  {t.unreadCount} new
                </Badge>
              ) : (
                <span className="text-3xs font-medium px-1.5 py-0.2 rounded-md border shrink-0 inline-flex items-center leading-normal text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25">
                  General Inquiry
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Client Email / Project count + Timestamp */}
          <div className="flex items-center justify-between text-2xs text-muted-foreground mb-1 w-full gap-1 pl-6.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-3xs text-muted-foreground truncate">
                {t.clientEmail || `${t.messageCount} ${t.messageCount === 1 ? 'message' : 'messages'}`}
              </span>
              {typeof t.projectCount === 'number' && t.projectCount > 0 && (
                <span className="font-mono text-3xs text-foreground/85 bg-secondary/75 dark:bg-secondary/60 px-1.5 py-0.2 rounded border border-border/80 shrink-0 font-semibold">
                  {t.projectCount} {t.projectCount === 1 ? 'proj' : 'projs'}
                </span>
              )}
            </div>
            <span className="text-3xs shrink-0 font-mono tabular-nums text-muted-foreground/80">
              {t.lastMessageAt ? formatChatTimestamp(t.lastMessageAt) : ''}
            </span>
          </div>

          {/* Row 3: Last Message Snippet */}
          <p
            className={cn(
              'text-2xs line-clamp-1 leading-relaxed w-full break-words text-muted-foreground/80 pl-6.5',
              hasUnread && 'font-medium text-foreground dark:text-amber-200'
            )}
          >
            {t.lastMessagePreview || 'No messages yet'}
          </p>

          {/* Row 4: Last chat by (Owner/Manager Name) */}
          {viewerRole === 'admin' && t.lastChatBy && (
            <div className="mt-1 flex items-center gap-1 text-3xs text-muted-foreground truncate pl-6.5">
              <MessageSquare className="size-2.5 text-amber-500/80 shrink-0" />
              <span className="truncate">
                Last chat by{' '}
                <span className="font-semibold text-foreground/90">
                  ({t.lastChatBy})
                </span>
              </span>
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <TooltipProvider delay={200}>
      <div className={cn('flex flex-col h-full bg-secondary/15', className)}>
        {/* ========================================================= */}
        {/* 1. TOP SWITCHER (Admin) OR PINNED GLOBAL CHAT (Client)    */}
        {/* ========================================================= */}
      <div className="p-2 border-b border-border/70 shrink-0 bg-background/60 backdrop-blur-xs">
        {viewerRole === 'admin' ? (
          <FilterTabs
            value={adminMode}
            onValueChange={(val) => {
              const nextMode = val as AdminSidebarMode;
              setAdminMode(nextMode);
              if (nextMode === 'inquiries') {
                onSelectProject(GLOBAL_CHAT_ID);
                if (!activeInquiryClientId && inquiryThreads.length > 0) {
                  onSelectInquiryClient?.(inquiryThreads[0].clientId);
                }
              } else if (isGlobalSelected) {
                const firstProj = loadedSessions[0] || projects[0];
                if (firstProj) {
                  onSelectProject(firstProj.id);
                }
              }
            }}
            size="sm"
            className="w-full"
            listClassName="w-full grid grid-cols-2"
            tabs={[
              {
                value: 'projects',
                label: 'Projects',
                icon: FolderKanban,
                count: totalProjectUnread > 0 ? totalProjectUnread : totalSessions,
              },
              {
                value: 'inquiries',
                label: 'Inquiries',
                icon: MessageSquare,
                count:
                  totalInquiryUnread > 0
                    ? totalInquiryUnread
                    : inquiryThreads.length > 0
                    ? inquiryThreads.length
                    : undefined,
              },
            ]}
          />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isGlobalSelected}
                onClick={() => onSelectProject(GLOBAL_CHAT_ID)}
                className={cn(
                  'group/global-item cursor-pointer px-2.5 py-2 h-auto rounded-lg transition-all border flex flex-col items-stretch text-left relative overflow-hidden',
                  isGlobalSelected
                    ? 'border-amber-400/80 bg-amber-400/[0.08] data-active:bg-amber-400/[0.08] hover:bg-amber-400/[0.12] data-active:text-foreground shadow-xs ring-1 ring-amber-400/25'
                    : 'border-border/80 bg-card/85 hover:border-amber-400/45 hover:bg-amber-400/[0.04]'
                )}
              >
                {isGlobalSelected && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r-xs" />
                )}

                {/* Row 1: Icon + Title on left, Badge or Status on right */}
                <div className="flex items-center justify-between gap-1.5 w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MessageSquare
                      className={cn(
                        'size-3.5 shrink-0 transition-colors',
                        isGlobalSelected
                          ? 'text-brand-text dark:text-amber-300'
                          : 'text-brand-text/80 dark:text-amber-400'
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs font-bold tracking-tight truncate',
                        isGlobalSelected
                          ? 'text-brand-text dark:text-amber-200'
                          : 'text-foreground'
                      )}
                    >
                      Ask the Studio Team
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {globalUnread > 0 ? (
                      <Badge
                        variant="gold-solid"
                        className="text-2xs font-mono font-black tabular-nums px-1.5 py-0 h-4 shrink-0"
                      >
                        {globalUnread} new
                      </Badge>
                    ) : (
                      <span
                        className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0 mr-0.5"
                        title="Studio Team Live"
                      />
                    )}
                  </div>
                </div>

                {/* Row 2: Clean Subtitle / Last Message */}
                <p
                  className={cn(
                    'text-2xs truncate w-full mt-0.5 leading-relaxed',
                    globalUnread > 0
                      ? 'font-medium text-foreground dark:text-amber-200'
                      : 'text-muted-foreground'
                  )}
                >
                  Packages, credits &amp; custom requests
                </p>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. SECTION HEADER & CONTROLS                              */}
      {/* ========================================================= */}
      <div className="p-2 pb-1.5 border-b border-border/70 space-y-1.5 shrink-0 bg-background/40 mb-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex size-4 items-center justify-center rounded-md bg-amber-400/15 text-brand-text dark:text-amber-400">
              {viewerRole === 'admin' && adminMode === 'inquiries' ? (
                <MessageSquare className="size-3" />
              ) : (
                <FolderKanban className="size-3" />
              )}
            </span>
            <span className="text-2xs font-bold tracking-wider uppercase text-muted-foreground/80">
              {viewerRole === 'admin'
                ? adminMode === 'inquiries'
                  ? 'CLIENT INQUIRIES'
                  : 'CLIENT PROJECTS'
                : 'MY PROJECTS'}
            </span>
            <Badge variant="outline" className="text-2xs font-mono tabular-nums h-4 px-1.5 font-semibold text-muted-foreground">
              {viewerRole === 'admin' && adminMode === 'inquiries'
                ? inquiryThreads.length
                : totalSessions}
            </Badge>
          </div>

          {viewerRole === 'admin' ? (
            adminMode === 'inquiries' ? (
              <Badge
                variant="outline"
                className="text-3xs font-medium px-1.5 py-0 h-5 border-amber-400/30 text-brand-text dark:text-amber-300 bg-amber-400/10 rounded-md"
              >
                1-on-1 Threads
              </Badge>
            ) : (
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
            )
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
            placeholder={
              viewerRole === 'admin'
                ? adminMode === 'inquiries'
                  ? 'Search client name, email, or message...'
                  : 'Search projects or clients...'
                : 'Search projects...'
            }
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

        {/* Reusable Filter Tabs (Consistent with whole project design system) */}
        {viewerRole === 'admin' && adminMode === 'inquiries' ? (
          <FilterTabs
            value={inquiryTab}
            onValueChange={(val) => setInquiryTab(val as InquiryFilterTab)}
            size="sm"
            className="w-full"
            listClassName="w-full grid grid-cols-2"
            tabs={[
              { value: 'all', label: 'All Clients', count: inquiryThreads.length },
              {
                value: 'unread',
                label: 'Unread',
                count: totalInquiryUnread > 0 ? totalInquiryUnread : undefined,
              },
            ]}
          />
        ) : (
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
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. SESSIONS LIST (Inquiries 1-on-1 or Paginated Projects) */}
      {/* ========================================================= */}
      <ScrollArea ref={scrollRef} className="flex-1 p-1.5 scrollbar-custom" aria-busy={isInitialLoading || isFetchingNextPage || isInquiriesLoading}>
        {viewerRole === 'admin' && adminMode === 'inquiries' ? (
          isInquiriesLoading && inquiryThreads.length === 0 ? (
            <div className="space-y-2 p-1" role="status" aria-label="Loading inquiries">
              {[1, 2, 3].map((i) => (
                <SessionSkeleton key={i} />
              ))}
            </div>
          ) : inquiryThreads.length === 0 && !debouncedSearch && inquiryTab === 'all' ? (
            <Empty className="py-6 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-amber-400/15 text-brand-text dark:text-amber-400 size-8">
                  <MessageSquare className="size-4" />
                </EmptyMedia>
                <EmptyTitle className="text-xs font-semibold tracking-tight">
                  No general inquiries yet
                </EmptyTitle>
                <EmptyDescription className="text-2xs text-muted-foreground leading-normal">
                  When clients ask questions in &ldquo;Ask the Studio Team&rdquo;, each client will appear here as a separate 1-on-1 conversation.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : filteredInquiryThreads.length === 0 ? (
            <Empty className="py-6 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-amber-400/15 text-brand-text dark:text-amber-400 size-8">
                  <Inbox className="size-4" />
                </EmptyMedia>
                <EmptyTitle className="text-xs font-semibold tracking-tight">
                  {inquiryTab === 'unread' && !debouncedSearch ? 'All caught up' : 'No client inquiries found'}
                </EmptyTitle>
                <EmptyDescription className="text-2xs text-muted-foreground leading-normal">
                  {debouncedSearch
                    ? `No results for "${debouncedSearch}"`
                    : 'No unread general inquiries right now.'}
                </EmptyDescription>
                {(debouncedSearch || inquiryTab !== 'all') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedSearch('');
                      setInquiryTab('all');
                    }}
                    className="mt-1.5 h-7 text-2xs font-semibold"
                  >
                    Clear Filters
                  </Button>
                )}
              </EmptyHeader>
            </Empty>
          ) : (
            <div className={cn('space-y-1 transition-opacity', isSearching && 'opacity-60')}>
              {pinnedUnreadInquiries.length > 0 && (
                <>
                  {inquiryTab !== 'unread' && listedInquiries.length > 0 && (
                    <p className="px-1 pt-0.5 text-3xs font-bold uppercase tracking-wider text-muted-foreground/80">
                      Unread Inquiries ({pinnedUnreadInquiries.length})
                    </p>
                  )}
                  <SidebarMenu className="gap-1 space-y-1">
                    {pinnedUnreadInquiries.map(renderInquiryThread)}
                  </SidebarMenu>
                </>
              )}

              {listedInquiries.length > 0 && (
                <>
                  {pinnedUnreadInquiries.length > 0 && (
                    <p className="px-1 pt-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground/80">
                      All Client Inquiries
                    </p>
                  )}
                  <SidebarMenu className="gap-1 space-y-1">
                    {listedInquiries.map(renderInquiryThread)}
                  </SidebarMenu>
                </>
              )}
            </div>
          )
        ) : isInitialLoading && visibleCount === 0 && activeTab !== 'unread' ? (
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
    </TooltipProvider>
  );
}

