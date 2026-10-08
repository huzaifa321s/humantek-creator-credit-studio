'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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

import { useStudioChat, ChatAttachment, GLOBAL_CHAT_ID, GLOBAL_META, ChatMessage } from '@/lib/chatStore';
import { useProjectChat } from '@/lib/chat/useProjectChat';
import { useProjectsQuery } from '@/lib/queries/projects';
import { toast } from 'sonner';
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
    messages: storeMessages,
    agent,
    isOpen,
    isTyping,
    totalUnreadCount,
    unreadCounts,
    setIsOpen,
    setActiveProjectId,
    sendMessage: sendStoreMessage,
    toggleReaction,
  } = useStudioChat();

  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const [hasOpened, setHasOpened] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prevIsOpenRef = useRef(isOpen);

  const isMobile = useIsMobile();
  const [userToggledSidebar, setUserToggledSidebar] = useState<boolean | null>(null);
  const isSidebarOpen = userToggledSidebar ?? !isMobile;

  const pathname = usePathname();
  const isMessagesRoute = pathname === '/messages';
  const isWizardRoute = pathname === '/' || pathname === '/new-project';
  const [hasFooter, setHasFooter] = useState(isWizardRoute);

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];

  // Derive active project metadata directly from TanStack Query without duplicating state into Zustand
  const activeProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  const targetProjectId = isGlobal || !activeProject || projectId === 'proj-demo-1' ? null : projectId;

  // Hook into real Supabase doorbell realtime transport & messages
  const {
    messages: dbMessages,
    lastReadId,
    sendMessage: sendDbMessage,
    markAsRead,
  } = useProjectChat({ projectId: targetProjectId });

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

  // Mark active project as read
  useEffect(() => {
    if (isOpen && !isGlobal && projectId) {
      markAsRead();
    }
  }, [isOpen, projectId, isGlobal, markAsRead, dbMessages]);

  const displayMessages: ChatMessage[] = useMemo(() => {
    if (isGlobal || !projectId) {
      return storeMessages;
    }
    if (dbMessages && dbMessages.length > 0) {
      return dbMessages.map((m) => ({
        id: String(m.id),
        projectId: m.projectId,
        sender: m.kind === 'system' ? 'system' : (m.sender?.role === 'admin' ? 'agent' : 'client'),
        senderName: m.sender?.role === 'admin' ? 'Sarah Miller' : (activeProject?.clientName || 'You (Creator)'),
        senderRole: m.sender?.role === 'admin' ? 'Senior Creative Producer' : 'Creator',
        content: m.body,
        timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: m.id <= lastReadId,
        attachments: (m.attachments || []).map((att) => ({
          id: att.id,
          name: att.fileName,
          size: `${Math.round(att.fileSize / 1024)} KB`,
          type: att.mimeType.startsWith('image/') ? 'image' : 'file',
          url: att.url || '',
          previewUrl: att.mimeType.startsWith('image/') ? att.url || '' : undefined,
        })),
      }));
    }
    return storeMessages;
  }, [isGlobal, projectId, storeMessages, dbMessages, lastReadId, activeProject]);

  const handleSendMessage = async (text: string, attachments?: ChatAttachment[]) => {
    if (!isGlobal && projectId) {
      try {
        await sendDbMessage(text);
        return;
      } catch (err: any) {
        toast.error(err.message || 'Failed to send message');
        return;
      }
    }
    sendStoreMessage(text, attachments);
  };

  // Mount drawer contents when opened
  useEffect(() => {
    if (isOpen) {
      setHasOpened(true);
    }
  }, [isOpen]);

  // Focus management: move focus into drawer on open, restore to launcher on close
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    } else if (!isOpen && prevIsOpenRef.current) {
      launcherRef.current?.focus();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

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
  const isManagementRoute = Boolean(pathname?.startsWith('/management'));
  if (isMessagesRoute || isAuthRoute || isManagementRoute) return null;

  return (
    <>
      {/* 1. Floating Launcher (Single Compact Chat Trigger Button) */}
      <div
        className={cn(
          'fixed right-5 sm:right-6 md:right-7 z-50 transition-all duration-300 ease-in-out motion-reduce:transition-none',
          hasFooter ? 'bottom-20 sm:bottom-22' : 'bottom-5 sm:bottom-6',
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
      >
        <Button
          ref={launcherRef}
          type="button"
          variant="outline"
          onPointerEnter={() => setHasOpened(true)}
          onFocus={() => setHasOpened(true)}
          onClick={() => {
            setHasOpened(true);
            setIsOpen(true, isWizardRoute ? GLOBAL_CHAT_ID : undefined);
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

      {/* 2. Slide-over Panel Workspace (Hybrid Two-Column Drawer) */}
      {/* Backdrop overlay (plain opacity fade, zero blur-filter shader penalty during animation) */}
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ease-out motion-reduce:transition-none',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Studio Messages & Project Discussion"
        inert={!isOpen}
        className={cn(
          'fixed inset-y-0 right-0 z-50 h-[100dvh] sm:h-full w-full sm:w-[680px] md:w-[780px] lg:w-[860px] max-w-full',
          'bg-card border-l border-border flex flex-col overflow-hidden',
          'transition-transform duration-300 ease-out motion-reduce:transition-none',
          isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'
        )}
      >
        {hasOpened && (
          <>
            {/* ========================================================= */}
            {/* 1. TOP AGENT BAR (Lightweight & Reassuring, px-4 py-2.5)   */}
            {/* ========================================================= */}
            <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 border-b border-border/80 bg-secondary/35 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                {/* Sidebar toggle button (desktop only) */}
                {projects.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setUserToggledSidebar(!isSidebarOpen)}
                    title={isSidebarOpen ? 'Collapse Project Sessions' : 'Show Project Sessions'}
                    className={cn(
                      'hidden sm:inline-flex h-8 w-8 rounded-lg cursor-pointer transition-colors',
                      isSidebarOpen && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <PanelLeft className="size-4" />
                  </Button>
                )}

                <div className="relative shrink-0">
                  <Avatar className="size-8 sm:size-8.5 border border-amber-500/50 bg-gradient-to-br from-amber-500/20 to-amber-600/30 shadow-2xs">
                    <AvatarFallback className="bg-transparent text-amber-800 dark:text-amber-300 font-semibold text-xs">
                      {agent.avatarInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{agent.name}</span>
                    <span className="text-xs text-muted-foreground hidden xs:inline">· Lead Producer</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-2xs text-muted-foreground truncate">
                    <span className="flex size-1.5 rounded-full bg-emerald-500" />
                    <span>{agent.responseTime}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">
                  {projects.length} Active
                </span>
                <Button
                  ref={closeButtonRef}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  title="Close chat"
                  className="text-muted-foreground hover:text-foreground cursor-pointer size-8"
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
                    ? 'w-full sm:w-[245px] md:w-[255px] shrink-0 flex'
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
                <div className="sm:hidden px-3.5 py-1.5 border-b border-border/70 bg-secondary/30 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setUserToggledSidebar(true)}
                    className="h-7 text-xs font-semibold gap-1 text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 p-0 hover:bg-transparent cursor-pointer"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>All Project Chats</span>
                  </Button>
                  <span className="text-3xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                    {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                  </span>
                </div>

                {/* ========================================================= */}
                {/* 3. CONTEXT BAR: Global Header vs Project Context Bar      */}
                {/* ========================================================= */}
                {isGlobal ? (
                  <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-0 h-auto flex flex-col justify-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground">Global Chat</span>
                        <span className="flex size-1.5 rounded-full bg-emerald-500 inline-block align-middle" />
                      </div>
                      <p className="text-2xs text-muted-foreground mt-0.5 leading-normal">
                        Replies in ~2 mins · Packages, credits & studio support
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 border-b border-border/70 bg-secondary/20 shrink-0 min-h-0 h-auto flex flex-col justify-center gap-1.5">
                    {/* Line 1: Code + Package + Status Badge (Left) & Milestone Tracker (Right) */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="font-mono text-xs font-bold tracking-tight text-foreground bg-secondary/80 dark:bg-secondary/60 px-1.5 py-0.5 rounded border border-border/70 shrink-0">
                          {displayMeta.projectCode}
                        </span>
                        <span className="text-foreground/90 font-semibold text-xs truncate max-w-[130px] sm:max-w-[220px]">
                          {displayMeta.packageName}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-3xs font-medium lowercase px-1.5 py-0 h-4 shrink-0 text-muted-foreground border-border/70 rounded-md"
                        >
                          {displayMeta.status.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      </div>

                      <Link
                        href="/projects"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-2xs sm:text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline shrink-0 bg-amber-500/10 dark:bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/20 transition-colors"
                      >
                        <span className="hidden min-[380px]:inline">Milestone Tracker</span>
                        <span className="min-[380px]:hidden">Milestones</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </Link>
                    </div>

                    {/* Line 2: Client Info · Credits Badge · Price */}
                    <div className="flex items-center gap-1.5 text-2xs text-muted-foreground flex-wrap min-w-0">
                      <span className="inline-flex items-center gap-1 truncate max-w-[160px] sm:max-w-[240px]">
                        Client: <b className="text-foreground font-medium truncate">{displayMeta.clientName}</b>
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="inline-flex items-center font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/25 shrink-0">
                        {displayMeta.credits || 660} CR
                      </span>
                      {displayMeta.price && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="font-mono tabular-nums text-foreground/80 font-medium shrink-0">
                            ${displayMeta.price.toLocaleString()} USD
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Message Scroller Feed */}
                <div className="flex-1 min-h-0 bg-card/60">
                  <ChatMessageList
                    messages={displayMessages}
                    isTyping={isTyping}
                    agentName={agent.name}
                    isGlobal={isGlobal}
                    className="h-full"
                    contentClassName="px-3.5 sm:px-4 py-3 gap-3"
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
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border/70 bg-card shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <ChatInputBar
                    onSendMessage={handleSendMessage}
                    isTyping={isTyping}
                    compact
                    isGlobal={isGlobal}
                    activeProjectCode={isGlobal ? undefined : displayMeta.projectCode}
                    activeProjectName={isGlobal ? undefined : displayMeta.packageName}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Lightbox Preview Modal */}
      <ChatAttachmentModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </>
  );
}
