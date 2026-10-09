'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Search,
  Plus,
  X,
  Sparkles,
  Inbox,
  Filter,
  Globe,
  MessageSquare,
} from 'lucide-react';
import { cn, formatChatTimestamp } from '@/lib/utils';
import { ProjectMeta, ChatMessage, GLOBAL_CHAT_ID } from '@/lib/chatStore';

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

export interface ChatProjectSidebarProps {
  projects: Array<{
    id: string;
    projectCode: string;
    packageName: string;
    clientName: string;
    status: string;
    packagePrice?: number;
    packageCredits?: number;
  }>;
  activeProjectId: string;
  unreadCounts: Record<string, number>;
  projectMessages: Record<string, ChatMessage[]>;
  onSelectProject: (projectId: string) => void;
  onNewBriefClick?: () => void;
  isLoading?: boolean;
  className?: string;
}

type FilterTab = 'all' | 'active' | 'unread';

export function ChatProjectSidebar({
  projects,
  activeProjectId,
  unreadCounts,
  projectMessages,
  onSelectProject,
  onNewBriefClick,
  isLoading = false,
  className,
}: ChatProjectSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const isGlobalSelected = activeProjectId === GLOBAL_CHAT_ID;
  const globalMsgs = projectMessages[GLOBAL_CHAT_ID] || [];
  const lastGlobalMsg = globalMsgs[globalMsgs.length - 1];
  const globalUnread = unreadCounts[GLOBAL_CHAT_ID] || 0;
  const lastGlobalPreview = lastGlobalMsg
    ? `${lastGlobalMsg.sender === 'client' ? 'You: ' : 'Sarah: '}${lastGlobalMsg.content}`
    : 'Ask about packages, credits, or studio services...';

  const totalProjectUnread = useMemo(() => {
    return Object.entries(unreadCounts).reduce((acc, [id, count]) => {
      if (id === GLOBAL_CHAT_ID) return acc;
      return acc + count;
    }, 0);
  }, [unreadCounts]);

  const filteredProjects = useMemo(() => {
    let result = projects;

    // Filter by tab
    if (activeTab === 'unread') {
      result = result.filter((p) => (unreadCounts[p.id] || 0) > 0);
    } else if (activeTab === 'active') {
      result = result.filter((p) => p.status !== 'completed' && p.status !== 'archived');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.projectCode.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          p.packageName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [projects, activeTab, searchQuery, unreadCounts]);

  return (
    <div className={cn('flex flex-col h-full bg-secondary/15', className)}>
      {/* ========================================================= */}
      {/* 1. PINNED GLOBAL CHAT (Always at the very top)            */}
      {/* ========================================================= */}
      <div className="p-2 border-b border-border/70 shrink-0 bg-background/60 backdrop-blur-xs mb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isGlobalSelected}
              onClick={() => onSelectProject(GLOBAL_CHAT_ID)}
              className={cn(
                'group/global-item cursor-pointer px-2.5 py-2 h-auto min-h-[50px] rounded-lg transition-all border flex flex-col items-stretch text-left relative overflow-hidden',
                isGlobalSelected
                  ? 'border-amber-400 bg-amber-400/15 dark:bg-amber-400/25 shadow-xs ring-1 ring-amber-400/40'
                  : 'border-amber-400/30 dark:border-amber-400/35 bg-amber-400/[0.06] dark:bg-amber-400/[0.10] hover:bg-amber-400/12 hover:border-amber-400/50 shadow-2xs'
              )}
            >
              {isGlobalSelected && (
                <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r-xs" />
              )}

              <div className="flex items-center justify-between gap-1.5 mb-1 w-full">
                <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md transition-all shadow-2xs',
                      isGlobalSelected
                        ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 font-black shadow-amber-400/20'
                        : 'bg-amber-400/20 text-brand-text dark:text-amber-300'
                    )}
                  >
                    <Globe className="size-3" />
                  </span>
                  <span
                    className={cn(
                      'text-xs font-bold tracking-tight whitespace-nowrap',
                      isGlobalSelected
                        ? 'text-brand-text dark:text-amber-200'
                        : 'text-foreground'
                    )}
                  >
                    Global Chat
                  </span>
                  <span className="text-3xs uppercase tracking-wider font-semibold text-brand-text dark:text-amber-400 bg-amber-400/15 dark:bg-amber-400/20 px-1 py-0.2 rounded border border-amber-400/20">
                    Concierge
                  </span>
                </div>

                {globalUnread > 0 ? (
                  <Badge
                    variant="destructive"
                    className="text-2xs font-mono font-bold tabular-nums px-1.5 py-0 h-4 shrink-0 animate-pulse"
                  >
                    {globalUnread} new
                  </Badge>
                ) : (
                  <span className="text-2xs font-mono tabular-nums text-muted-foreground/80 shrink-0 whitespace-nowrap">
                    {lastGlobalMsg
                      ? formatChatTimestamp(lastGlobalMsg.timestamp)
                      : ''}
                  </span>
                )}
              </div>

              <p
                className={cn(
                  'text-2xs line-clamp-2 leading-relaxed pl-6.5 w-full break-words',
                  globalUnread > 0
                    ? 'font-medium text-foreground dark:text-amber-200'
                    : 'text-muted-foreground'
                )}
              >
                {lastGlobalPreview}
              </p>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      {/* ========================================================= */}
      {/* 2. PROJECT SESSIONS SECTION HEADER & CONTROLS             */}
      {/* ========================================================= */}
      <div className="p-2 pb-1.5 border-b border-border/70 space-y-1.5 shrink-0 bg-background/40 mb-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex size-4 items-center justify-center rounded-md bg-amber-400/15 text-brand-text dark:text-amber-400">
              <FolderKanban className="size-3" />
            </span>
            <span className="text-2xs font-bold tracking-wider uppercase text-muted-foreground/80">
              PROJECT SESSIONS
            </span>
            <Badge variant="outline" className="text-2xs font-mono tabular-nums h-4 px-1.5 font-semibold text-muted-foreground">
              {projects.length}
            </Badge>
          </div>

          <Link href="/" onClick={onNewBriefClick}>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 px-1.5 text-2xs font-semibold gap-1 text-brand-text dark:text-amber-400 hover:bg-amber-400/15 rounded-md cursor-pointer"
            >
              <Plus className="size-3" />
              <span>+ New Brief</span>
            </Button>
          </Link>
        </div>

        {/* Search input with clear button */}
        <div className="relative">
          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Search code or name..."
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
            { value: 'all', label: 'All', count: projects.length },
            { value: 'active', label: 'Active' },
            {
              value: 'unread',
              label: 'Unread',
              count: totalProjectUnread > 0 ? totalProjectUnread : undefined,
            },
          ]}
        />
      </div>

      {/* ========================================================= */}
      {/* 3. PROJECT SESSIONS LIST                                  */}
      {/* ========================================================= */}
      <ScrollArea className="flex-1 p-1.5">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg border border-border/60 bg-card/60 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-20 rounded-md" />
                  <Skeleton className="h-3 w-12 rounded-full" />
                </div>
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-36 rounded-md" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Empty className="py-6 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-amber-400/15 text-brand-text dark:text-amber-400 size-8">
                <FolderKanban className="size-4" />
              </EmptyMedia>
              <EmptyTitle className="text-xs font-semibold tracking-tight">No project channels yet</EmptyTitle>
              <EmptyDescription className="text-2xs text-muted-foreground leading-normal">
                Submit a creative brief to start a dedicated workspace.
              </EmptyDescription>
              <Link href="/" onClick={onNewBriefClick} className="mt-1.5">
                <Button type="button" variant="outline" size="xs" className="h-7 gap-1 text-2xs font-semibold">
                  <Plus className="size-3" />
                  <span>+ New Brief</span>
                </Button>
              </Link>
            </EmptyHeader>
          </Empty>
        ) : filteredProjects.length === 0 ? (
          <Empty className="py-6 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-amber-400/15 text-brand-text dark:text-amber-400 size-8">
                <Inbox className="size-4" />
              </EmptyMedia>
              <EmptyTitle className="text-xs font-semibold tracking-tight">No projects match</EmptyTitle>
              <EmptyDescription className="text-2xs text-muted-foreground leading-normal">
                {searchQuery ? `No results for "${searchQuery}"` : 'No projects found in this category'}
              </EmptyDescription>
              {(searchQuery || activeTab !== 'all') && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveTab('all');
                  }}
                  className="mt-1.5 h-7 text-2xs font-semibold"
                >
                  Clear Filters
                </Button>
              )}
            </EmptyHeader>
          </Empty>
        ) : (
          <SidebarMenu className="gap-1 space-y-1">
            {filteredProjects.map((p) => {
              const isSelected = p.id === activeProjectId;
              const pUnread = unreadCounts[p.id] || 0;
              const pMsgs = projectMessages[p.id] || [];
              const lastMsg = pMsgs[pMsgs.length - 1];

              const lastPreview = lastMsg
                ? `${lastMsg.sender === 'client' ? 'You: ' : 'Sarah: '}${lastMsg.content}`
                : 'Project workspace created';

              return (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={isSelected}
                    onClick={() => onSelectProject(p.id)}
                    className={cn(
                      'group/project-item cursor-pointer py-2 px-2.5 h-auto min-h-[52px] rounded-lg transition-all border flex flex-col items-stretch text-left relative overflow-hidden',
                      isSelected
                        ? 'border-amber-400/80 bg-amber-400/10 shadow-xs ring-1 ring-amber-400/30'
                        : 'border-border/70 bg-card/60 hover:border-amber-400/50 hover:bg-secondary/40'
                    )}
                  >
                    {/* Left active accent bar indicator */}
                    {isSelected && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 rounded-r-xs" />
                    )}

                    <div className="flex items-center justify-between gap-1 mb-0.5 w-full">
                      <span
                        className={cn(
                          'font-mono text-xs font-bold tracking-tight truncate',
                          isSelected ? 'text-brand-text dark:text-amber-300' : 'text-foreground'
                        )}
                      >
                        {p.projectCode}
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
                          <Badge
                            variant="outline"
                            className="text-3xs font-medium lowercase px-1.5 py-0 h-4 shrink-0 text-muted-foreground border-border/70 rounded-md"
                          >
                            {p.status.replace('_', ' ').toLowerCase()}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-2xs text-muted-foreground mb-1 w-full">
                      <span className="font-medium text-foreground/85 truncate text-2xs">{p.packageName}</span>
                      <span className="text-3xs shrink-0 font-mono tabular-nums text-muted-foreground/80">
                        {lastMsg ? formatChatTimestamp(lastMsg.timestamp) : ''}
                      </span>
                    </div>

                    <p
                      className={cn(
                        'text-2xs line-clamp-2 leading-relaxed w-full break-words',
                        pUnread > 0
                          ? 'font-medium text-foreground dark:text-amber-200'
                          : 'text-muted-foreground'
                      )}
                    >
                      {lastPreview}
                    </p>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        )}
      </ScrollArea>
    </div>
  );
}
