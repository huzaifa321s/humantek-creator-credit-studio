'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  X,
  PanelLeft,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

import { useStudioChat, ChatAttachment, GLOBAL_CHAT_ID, GLOBAL_META } from '@/lib/chatStore';
import { useProjectsQuery } from '@/lib/queries/projects';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInputBar } from './ChatInputBar';
import { ChatAttachmentModal } from './ChatAttachmentModal';
import { ChatMessageList } from './ChatMessageList';
import { ChatProjectSidebar } from './ChatProjectSidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export function ChatFloatingWidget() {
  const {
    projectId,
    isGlobal,
    projectMeta,
    projectMessages,
    messages,
    agent,
    isOpen,
    isTyping,
    totalUnreadCount,
    unreadCounts,
    setIsOpen,
    setActiveProjectId,
    sendMessage,
    toggleReaction,
  } = useStudioChat();

  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const isMobile = useIsMobile();
  const [userToggledSidebar, setUserToggledSidebar] = useState<boolean | null>(null);
  const isSidebarOpen = userToggledSidebar ?? !isMobile;

  const pathname = usePathname();
  const isMessagesRoute = pathname === '/messages';
  const isWizardRoute = pathname === '/';
  const [hasFooter, setHasFooter] = useState(isWizardRoute);

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];

  // Derive active project metadata directly from TanStack Query without duplicating state into Zustand
  const activeProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  const displayMeta = isGlobal
    ? GLOBAL_META
    : activeProject
    ? {
        id: activeProject.id,
        projectCode: activeProject.projectCode,
        packageName: activeProject.packageName,
        clientName: activeProject.clientName,
        status: activeProject.status,
        price: activeProject.packagePrice,
        credits: activeProject.packageCredits,
      }
    : projectMeta;

  // Adjust bottom clearance when wizard sticky navigation footer is mounted
  useEffect(() => {
    if (!isWizardRoute) {
      setHasFooter(false);
      return;
    }

    const checkFooter = () => {
      const footerEl = document.getElementById('studio-footer-actions');
      setHasFooter(Boolean(footerEl));
    };

    checkFooter();
    const observer = new MutationObserver(checkFooter);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isWizardRoute]);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    if (isMobile) {
      setUserToggledSidebar(false);
    }
  };

  const isAuthRoute = Boolean(pathname?.startsWith('/login') || pathname?.startsWith('/sign-in'));
  if (isMessagesRoute || isAuthRoute) return null;

  return (
    <>
      {/* 1. Floating Launcher (Single Compact Chat Trigger Button) */}
      {!isOpen && (
        <div
          className={cn(
            'fixed right-5 sm:right-6 md:right-7 z-50 transition-all duration-300 ease-in-out',
            hasFooter ? 'bottom-20 sm:bottom-22' : 'bottom-5 sm:bottom-6'
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isWizardRoute) {
                setActiveProjectId(GLOBAL_CHAT_ID);
              }
              setIsOpen(true);
            }}
            aria-label="Open studio chat"
            className="group/chat-trigger h-9 sm:h-9.5 px-3 sm:px-3.5 py-1.5 rounded-lg bg-card hover:bg-amber-500/5 dark:bg-card border-border hover:border-amber-500/40 text-foreground shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer select-none flex items-center gap-2"
          >
            {/* Brand Orange Chat Icon */}
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover/chat-trigger:bg-amber-500/25 transition-colors">
              <MessageSquare className="size-3 text-amber-600 dark:text-amber-400" />
            </span>

            {/* Label: Chat with Our Team on wizard flow, or Messages on tracking views */}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-foreground font-semibold">
                {isWizardRoute || isGlobal ? 'Chat with Our Team' : 'Messages'}
              </span>
              <span className="text-muted-foreground/60 font-normal">·</span>
              <span
                className={cn(
                  'text-muted-foreground text-2xs font-medium',
                  isWizardRoute || isGlobal ? 'font-sans' : 'font-mono'
                )}
              >
                {isWizardRoute || isGlobal ? 'Sarah Miller' : displayMeta.projectCode}
              </span>
            </div>

            {/* Unread Message Count Badge */}
            {totalUnreadCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-0.5 h-4.5 px-1.5 text-2xs font-mono tabular-nums font-bold rounded-full bg-amber-500 text-white animate-pulse shadow-xs"
              >
                {totalUnreadCount}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* 2. Slide-over Panel Workspace (Hybrid Two-Column Drawer) */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
          />

          <div
            className={cn(
              'fixed right-0 top-0 bottom-0 z-50 h-full w-full sm:w-[680px] md:w-[780px] lg:w-[860px] max-w-full bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300'
            )}
          >
            {/* ========================================================= */}
            {/* 1. TOP AGENT BAR (Lightweight & Reassuring, px-4 py-2.5)   */}
            {/* ========================================================= */}
            <div className="px-4 py-2.5 border-b border-border/80 bg-secondary/35 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Sidebar toggle button (ChatGPT / Grok style) */}
                {projects.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setUserToggledSidebar(!isSidebarOpen)}
                    title={isSidebarOpen ? 'Collapse Project Sessions' : 'Show Project Sessions'}
                    className={cn(
                      'h-8 w-8 rounded-lg cursor-pointer transition-colors',
                      isSidebarOpen && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <PanelLeft className="size-4" />
                  </Button>
                )}

                <div className="relative shrink-0">
                  <Avatar className="size-8.5 border border-amber-500/50 bg-gradient-to-br from-amber-500/20 to-amber-600/30 shadow-2xs">
                    <AvatarFallback className="bg-transparent text-amber-800 dark:text-amber-300 font-semibold text-xs">
                      {agent.avatarInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground truncate">{agent.name}</span>
                    <span className="text-xs text-muted-foreground hidden xs:inline">· Lead Producer</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                    <span className="flex size-1.5 rounded-full bg-emerald-500" />
                    <span>{agent.responseTime}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">
                  {projects.length} Active
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  title="Close chat"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* 2. MAIN BODY: TWO-COLUMN LAYOUT                           */}
            {/* ========================================================= */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
              {/* LEFT COLUMN: Pinned Global Chat + Project Sessions Sidebar */}
              <div
                className={cn(
                  'border-r border-border/80 flex flex-col transition-all duration-200 z-10',
                  isSidebarOpen
                    ? 'w-full sm:w-[235px] md:w-[245px] shrink-0 flex'
                    : 'hidden sm:hidden'
                )}
              >
                <ChatProjectSidebar
                  projects={projects}
                  activeProjectId={projectId}
                  unreadCounts={unreadCounts}
                  projectMessages={projectMessages}
                  onSelectProject={handleSelectProject}
                  onNewBriefClick={() => setIsOpen(false)}
                  isLoading={projectsQuery.isPending}
                  className="h-full border-0"
                />
              </div>

              {/* RIGHT COLUMN: Chat Header + Messages Feed */}
              <div
                className={cn(
                  'flex-1 flex flex-col min-w-0 bg-card overflow-hidden',
                  isSidebarOpen ? 'hidden sm:flex' : 'flex'
                )}
              >
                {/* Mobile Back button when sidebar is collapsed */}
                <div className="sm:hidden px-3 py-1.5 border-b border-border/70 bg-secondary/25 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setUserToggledSidebar(true)}
                    className="h-7 text-xs font-medium gap-1 text-amber-700 dark:text-amber-400 cursor-pointer"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Back to chats</span>
                  </Button>
                  <span className="text-2xs font-mono font-medium text-muted-foreground">
                    {isGlobal ? 'Global Chat' : displayMeta.projectCode}
                  </span>
                </div>

                {/* ========================================================= */}
                {/* 3. CONTEXT BAR: Global Header vs Project Context Bar      */}
                {/* ========================================================= */}
                {isGlobal ? (
                  <div className="px-4 py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-[56px] max-h-[60px] flex flex-col justify-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold tracking-tight text-foreground">Global Chat</span>
                        <span className="flex size-1.5 rounded-full bg-emerald-500 inline-block align-middle" />
                      </div>
                      <p className="text-2xs text-muted-foreground mt-0.5 leading-normal">
                        Replies in ~2 mins · Packages, credits & studio support
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-[56px] max-h-[60px] flex flex-col justify-center gap-1">
                    {/* Line 1: Code · Package · Status */}
                    <div className="flex items-center gap-2 flex-wrap text-xs font-medium">
                      <span className="font-mono text-xs font-bold tracking-tight text-foreground">
                        {displayMeta.projectCode}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-foreground/90 font-medium text-xs">
                        {displayMeta.packageName}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <Badge variant="outline" className="text-2xs font-medium lowercase px-1.5 py-0 h-4 shrink-0 text-muted-foreground border-border/70 rounded-md">
                        {displayMeta.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </div>

                    {/* Line 2: Client · Credits · Price (left) + Milestone Tracker ↗ (right) */}
                    <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground mt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>Client: <b className="text-foreground font-medium">{displayMeta.clientName}</b></span>
                        <span>·</span>
                        <span className="font-mono tabular-nums"><b className="text-amber-600 dark:text-amber-400 font-semibold">{displayMeta.credits || 660} CR</b></span>
                        {displayMeta.price && (
                          <>
                            <span>·</span>
                            <span className="font-mono tabular-nums">${displayMeta.price.toLocaleString()} USD</span>
                          </>
                        )}
                      </div>

                      <Link
                        href="/projects"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline shrink-0"
                      >
                        <span>Milestone Tracker</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Message Scroller Feed */}
                <div className="flex-1 min-h-0 bg-card/60">
                  <ChatMessageList
                    messages={messages}
                    isTyping={isTyping}
                    agentName={agent.name}
                    isGlobal={isGlobal}
                    contentClassName="px-4 py-3 gap-3"
                    renderMessage={(msg) => (
                      <ChatMessageItem
                        message={msg}
                        compact
                        onPreviewAttachment={setPreviewAttachment}
                        onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                      />
                    )}
                  />
                </div>

                {/* Input Bar Footer */}
                <div className="px-4 py-3 border-t border-border/70 bg-card shrink-0">
                  <ChatInputBar
                    onSendMessage={sendMessage}
                    isTyping={isTyping}
                    compact
                    isGlobal={isGlobal}
                    activeProjectCode={isGlobal ? undefined : displayMeta.projectCode}
                    activeProjectName={isGlobal ? undefined : displayMeta.packageName}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Lightbox Preview Modal */}
      <ChatAttachmentModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </>
  );
}
