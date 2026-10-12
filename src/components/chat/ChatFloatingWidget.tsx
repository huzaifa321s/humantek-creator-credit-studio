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
import { cn, getErrorMessage } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

import { useStudioChat, ChatAttachment, GLOBAL_CHAT_ID, GLOBAL_META, ChatMessage, ChatReplyTo } from '@/lib/chatStore';
import { mapProjectChatMessage } from '@/lib/chat/mapMessage';
import { useUserStore } from '@/lib/userStore';
import { useProjectChat } from '@/lib/chat/useProjectChat';
import { useProjectsQuery, useProjectDetailQuery } from '@/lib/queries/projects';
import type { ProjectRecord } from '@/types';
import { toast } from 'sonner';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInputBar } from './ChatInputBar';
import { ChatAttachmentModal } from './ChatAttachmentModal';
import { ChatMessageList } from './ChatMessageList';
import { ChatProjectSidebar } from './ChatProjectSidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatGate } from '@/components/chat/ChatGate';

const EMPTY_PROJECTS: ProjectRecord[] = [];

function ChatFloatingWidgetInner() {
  const {
    projectId,
    isGlobal,
    outbox,
    isOpen,
    totalUnreadCount,
    unreadCounts,
    unreadBelowScroll,
    incrementUnreadBelowScroll,
    clearUnreadBelowScroll,
    queueMessage,
    removeMessage,
    markMessageFailed,
    setIsOpen,
    setActiveProjectId,
  } = useStudioChat();

  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
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
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;

  // Derive active project metadata directly from TanStack Query
  const projectFromList = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  // Sidebar is paginated: a selected session may live beyond the first page, so fall back to the detail query
  const needsDetailLookup = !isGlobal && !projectFromList && !!projectId;
  const activeDetailQuery = useProjectDetailQuery(needsDetailLookup ? projectId : null);
  const activeProject = projectFromList ?? activeDetailQuery.data ?? undefined;

  const { user } = useUserStore();
  const targetProjectId = isGlobal ? GLOBAL_CHAT_ID : activeProject ? projectId : null;

  // Real Supabase doorbell realtime transport & messages
  const {
    messages: dbMessages,
    lastReadId,
    isLoading: isDbLoading,
    sendMessage: sendDbMessage,
    toggleLike: toggleDbLike,
    editMessage: editDbMessage,
    deleteMessage: deleteDbMessage,
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
    : GLOBAL_META;

  // Mark active conversation (project or global) as read
  useEffect(() => {
    if (isOpen && targetProjectId) {
      markAsRead();
    }
  }, [isOpen, targetProjectId, markAsRead, dbMessages]);

  const displayMessages: ChatMessage[] = useMemo(() => {
    if (!targetProjectId) {
      return [];
    }
    const clientName = isGlobal ? (user?.name || 'You') : (activeProject?.clientName || user?.name || 'You');
    const mappedDb = (dbMessages || []).map((m) =>
      mapProjectChatMessage(m, { clientName, lastReadId })
    );

    // Include pending/failed optimistic messages from outbox that haven't landed in dbMessages yet
    const confirmedClientIds = new Set(
      dbMessages.map((m) => m.clientMessageId).filter(Boolean)
    );
    const pendingOptimistic = outbox.filter(
      (m: ChatMessage) =>
        m.clientMessageId &&
        !confirmedClientIds.has(m.clientMessageId) &&
        (m.status === 'sending' || m.status === 'failed')
    );

    return [...mappedDb, ...pendingOptimistic];
  }, [targetProjectId, isGlobal, dbMessages, lastReadId, activeProject, user?.name, outbox]);

  const handleSendMessage = async (text: string, attachments?: ChatAttachment[], replyTo?: ChatReplyTo) => {
    if (!targetProjectId) return;
    const senderName = isGlobal ? (user?.name || 'You') : (activeProject?.clientName || user?.name || 'You');
    const clientMsgId = queueMessage(text, { attachments, replyTo, senderName });
    if (!clientMsgId) return;

    try {
      await sendDbMessage(text, attachments, clientMsgId, replyTo);
      removeMessage(clientMsgId);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to send message');
      markMessageFailed(clientMsgId, message);
      toast.error(message);
    }
  };

  const handleRetryMessage = async (clientMsgId: string) => {
    const target = outbox.find((m) => m.clientMessageId === clientMsgId || m.id === clientMsgId);
    if (!target) return;
    removeMessage(clientMsgId);
    await handleSendMessage(target.content, target.attachments, target.replyTo);
  };

  const handleToggleLike = async (messageId: string) => {
    const currentName = user?.name || user?.email?.split('@')[0] || 'You';
    const numericId = parseInt(messageId, 10);
    if (targetProjectId && !isNaN(numericId)) {
      try {
        await toggleDbLike(numericId, user?.id, currentName);
      } catch (err) {
        console.error('Failed to toggle like in DB:', err);
      }
    }
  };

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    const numericId = parseInt(messageId, 10);
    if (targetProjectId && !isNaN(numericId)) {
      try {
        await editDbMessage(numericId, newContent);
        toast.success('Message updated');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to edit message'));
      }
    }
    setEditingMessage(null);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const numericId = parseInt(messageId, 10);
    if (targetProjectId && !isNaN(numericId)) {
      try {
        await deleteDbMessage(numericId);
        toast.success('Message deleted');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to delete message'));
      }
    }
  };

  const handleReplyTo = (message: ChatMessage) => {
    setEditingMessage(null);
    setReplyingTo({
      id: message.id,
      senderName: message.senderName,
      senderRole: message.senderRole,
      content: message.content,
    });
  };

  const handleStartEdit = (message: ChatMessage) => {
    setReplyingTo(null);
    setEditingMessage(message);
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400/80', 'rounded-xl', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-400/80', 'rounded-xl');
      }, 1500);
    }
  };

  // Mount drawer contents the first time it opens
  if (isOpen && !hasOpened) {
    setHasOpened(true);
  }

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
    if (!isWizardRoute) return;

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
  if (!user?.email || isMessagesRoute || isAuthRoute || isManagementRoute) return null;

  return (
    <>
      {/* 1. Floating Launcher (Single Compact Chat Trigger Button) */}
      <div
        className={cn(
          'fixed right-5 sm:right-6 md:right-7 z-50 transition-all duration-300 ease-in-out motion-reduce:transition-none',
          isWizardRoute && hasFooter ? 'hidden md:block bottom-20 md:bottom-22' : 'bottom-5 sm:bottom-6',
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
      >
        <Button
          data-chat-entry="floating-launcher"
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
          className="group/chat-trigger h-9 sm:h-9.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-card hover:bg-amber-400/[0.04] dark:bg-card border-border hover:border-amber-400/50 text-foreground shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer select-none flex items-center gap-1.5 sm:gap-2"
        >
          {/* Brand Orange Chat Icon */}
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-400/15 text-brand-text dark:text-amber-400 group-hover/chat-trigger:bg-amber-400/25 transition-colors">
            <MessageSquare className="size-3 text-brand-text dark:text-amber-400" />
          </span>

          {/* Label */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className="text-foreground font-semibold">
              <span className="hidden sm:inline">{isWizardRoute || isGlobal ? 'Help & Support' : 'Messages'}</span>
              <span className="sm:hidden">{isWizardRoute || isGlobal ? 'Help' : 'Messages'}</span>
            </span>
            <span className="hidden sm:inline text-muted-foreground/60 font-normal">·</span>
            <span
              className={cn(
                'hidden sm:inline text-muted-foreground text-2xs font-medium',
                isWizardRoute || isGlobal ? 'font-sans' : 'font-mono'
              )}
            >
              {isWizardRoute || isGlobal ? 'Studio Support' : displayMeta.projectCode}
            </span>
          </div>

          {/* Unread Message Count Badge */}
          {totalUnreadCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-0.5 h-4.5 px-1.5 text-2xs font-mono tabular-nums font-black rounded-full bg-amber-400 text-zinc-950 animate-pulse shadow-xs shadow-amber-400/30"
            >
              {totalUnreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* 2. Slide-over Panel Workspace */}
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ease-out motion-reduce:transition-none',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      <aside
        data-chat-entry="floating-drawer"
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
            {/* Top Bar */}
            <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 border-b border-border/80 bg-secondary/35 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
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

                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 shadow-2xs">
                  <MessageSquare className="size-4" />
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-foreground truncate">Humantek Studio</span>
                    <span className="text-xs text-muted-foreground hidden xs:inline">· Studio Team</span>
                  </div>
                  <div className="text-2xs text-muted-foreground truncate">
                    Studio Support &amp; Production
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

            {/* Main Body */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
              {/* Left Column: Sessions Sidebar */}
              <div
                className={cn(
                  'border-r border-border/80 flex flex-col transition-all duration-200 z-10',
                  isSidebarOpen
                    ? 'w-full sm:w-[260px] md:w-[270px] shrink-0 flex'
                    : 'hidden sm:hidden'
                )}
              >
                <ChatProjectSidebar
                  projects={projects}
                  activeProjectId={projectId}
                  unreadCounts={unreadCounts}
                  onSelectProject={handleSelectProject}
                  onNewProjectClick={() => setIsOpen(false)}
                  className="h-full border-0"
                />
              </div>

              {/* Right Column: Chat Feed or Global Help View */}
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
                    className="h-7 text-xs font-semibold gap-1 text-brand-text dark:text-amber-400 hover:underline p-0 hover:bg-transparent cursor-pointer"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>All Project Chats</span>
                  </Button>
                  <span className="text-3xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                    {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                  </span>
                </div>

                {!isGlobal && activeProject && (
                  <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 border-b border-border/70 bg-secondary/20 shrink-0 min-h-0 h-auto flex flex-col justify-center gap-1">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="font-mono text-xs font-bold tracking-tight text-foreground bg-secondary/80 dark:bg-secondary/60 px-1.5 py-0.5 rounded border border-border/70 shrink-0">
                          {displayMeta.projectCode}
                        </span>
                        <span className="text-foreground/90 font-semibold text-xs truncate max-w-[110px] sm:max-w-[200px]">
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
                        className="inline-flex items-center gap-1 text-2xs sm:text-xs font-semibold text-brand-text dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline shrink-0 bg-amber-400/10 dark:bg-amber-400/15 px-2 py-0.5 rounded-md border border-amber-400/25 transition-colors"
                      >
                        <span>View Project</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-x-1.5 gap-y-0.5 text-2xs text-muted-foreground flex-wrap min-w-0">
                      <span className="inline-flex items-center font-mono tabular-nums font-bold text-brand-text dark:text-amber-400 bg-amber-400/10 dark:bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/25 shrink-0">
                        {displayMeta.credits || 0} CR
                      </span>
                      {displayMeta.price && (
                        <>
                          <span className="text-muted-foreground/50 hidden xs:inline">·</span>
                          <span className="font-mono tabular-nums text-foreground/80 font-medium shrink-0 hidden xs:inline">
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
                    isLoading={isDbLoading}
                    projectId={projectId}
                    unreadCount={unreadBelowScroll}
                    onClearUnread={clearUnreadBelowScroll}
                    onIncrementUnread={incrementUnreadBelowScroll}
                    className="h-full"
                    contentClassName="px-3.5 sm:px-4 py-3 gap-3"
                    renderMessage={(msg) => (
                      <ChatMessageItem
                        message={msg}
                        compact
                        currentUserId={user?.id}
                        onPreviewAttachment={setPreviewAttachment}
                        onReply={handleReplyTo}
                        onToggleLike={handleToggleLike}
                        onStartEdit={handleStartEdit}
                        onDelete={handleDeleteMessage}
                        onScrollToMessage={handleScrollToMessage}
                        onRetry={handleRetryMessage}
                      />
                    )}
                  />
                </div>

                {/* Input Bar Footer */}
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border/70 bg-card shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <ChatInputBar
                    onSendMessage={handleSendMessage}
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                    editingMessage={editingMessage}
                    onCancelEdit={() => setEditingMessage(null)}
                    onSaveEdit={handleSaveEdit}
                    compact
                    isGlobal={isGlobal}
                    projectId={projectId}
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

export function ChatFloatingWidget() {
  return (
    <ChatGate>
      <ChatFloatingWidgetInner />
    </ChatGate>
  );
}
