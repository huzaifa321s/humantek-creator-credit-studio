'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useStudioChat, useChatStore, ChatMessage, GLOBAL_CHAT_ID, ChatReplyTo } from '@/lib/chatStore';
import { mapProjectChatMessage } from '@/lib/chat/mapMessage';
import { useProjectChat } from '@/lib/chat/useProjectChat';
import { useProjectsQuery, useProjectDetailQuery } from '@/lib/queries/projects';
import { useUserStore } from '@/lib/userStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChatProjectSidebar,
  type GeneralInquiryThread,
} from '@/components/chat/ChatProjectSidebar';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatAttachmentModal } from '@/components/chat/ChatAttachmentModal';
import {
  ChevronLeft,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { cn, getProjectStatusLabel, getProjectStatusBadgeClass } from '@/lib/utils';
import { toast } from 'sonner';

import type { ProjectRecord, ChatAttachment } from '@/types';

const EMPTY_PROJECTS: ProjectRecord[] = [];
const INQUIRY_READ_STORAGE_KEY = 'humantek_admin_inquiry_read_v1';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface AdminInboxProps {
  initialProjectId?: string | null;
  initialClientId?: string | null;
}

function getPaymentBadge(status?: string) {
  switch (status) {
    case 'paid':
      return (
        <Badge
          variant="outline"
          className="text-3xs font-semibold px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 rounded-md"
        >
          Paid
        </Badge>
      );
    case 'refunded':
      return (
        <Badge
          variant="outline"
          className="text-3xs font-semibold px-1.5 py-0 h-4 border-rose-500/30 text-rose-700 dark:text-rose-300 bg-rose-500/10 rounded-md"
        >
          Refunded
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="text-3xs font-semibold px-1.5 py-0 h-4 border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-md"
        >
          Unpaid
        </Badge>
      );
  }
}

export function AdminInbox({ initialProjectId, initialClientId }: AdminInboxProps) {
  const queryClient = useQueryClient();
  const { user, canManageProjects } = useUserStore();
  const canReply = canManageProjects();

  // Synchronously initialize activeProjectId from deep-linked URL params before first render
  // so ChatInputBar and useProjectChat have a stable projectId immediately without a render-after-effect reset.
  useState(() => {
    if (initialProjectId) {
      useChatStore.setState({ activeProjectId: initialProjectId });
    } else if (initialClientId) {
      useChatStore.setState({ activeProjectId: GLOBAL_CHAT_ID });
    }
  });

  const {
    projectId,
    isGlobal,
    outbox,
    setActiveProjectId,
    unreadCounts,
    unreadBelowScroll,
    incrementUnreadBelowScroll,
    clearUnreadBelowScroll,
    queueMessage,
    removeMessage,
    markMessageFailed,
  } = useStudioChat();

  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [selectedInquiryClientId, setSelectedInquiryClientId] = useState<string | null>(
    () => initialClientId || null
  );
  const [clientReadMap, setClientReadMap] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(INQUIRY_READ_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [prevInitialClientId, setPrevInitialClientId] = useState(initialClientId);
  if (prevInitialClientId !== initialClientId) {
    setPrevInitialClientId(initialClientId);
    if (initialClientId) {
      setSelectedInquiryClientId(initialClientId);
    }
  }

  const activeThreadKey = isGlobal ? `global:${selectedInquiryClientId ?? ''}` : projectId;
  const [syncedThreadId, setSyncedThreadId] = useState(activeThreadKey);
  if (syncedThreadId !== activeThreadKey) {
    setSyncedThreadId(activeThreadKey);
    setReplyingTo(null);
    setEditingMessage(null);
    setPreviewAttachment(null);
  }

  const [showMobileThread, setShowMobileThread] = useState(() =>
    Boolean(initialProjectId || initialClientId)
  );
  const [prevInitialId, setPrevInitialId] = useState(initialProjectId);
  if (prevInitialId !== initialProjectId) {
    setPrevInitialId(initialProjectId);
    if (initialProjectId) {
      setShowMobileThread(true);
    }
  }

  // Set initial project when deep-linked URL param changes
  useEffect(() => {
    if (initialProjectId) {
      setActiveProjectId(initialProjectId);
    } else if (initialClientId) {
      setActiveProjectId(GLOBAL_CHAT_ID);
    }
  }, [initialProjectId, initialClientId, setActiveProjectId]);

  // Projects cache for fast initial sidebar display & fallback lookup
  const projectsQuery = useProjectsQuery();
  const initialProjects = projectsQuery.data ?? EMPTY_PROJECTS;

  const projectFromList = useMemo(
    () => initialProjects.find((p) => p.id === projectId || p.projectCode === projectId),
    [initialProjects, projectId]
  );

  const needsDetailLookup = !isGlobal && !projectFromList && Boolean(projectId);
  const activeDetailQuery = useProjectDetailQuery(needsDetailLookup ? projectId : null);
  const activeProject = projectFromList ?? activeDetailQuery.data ?? null;

  const resolvedProjectId =
    activeProject?.id ||
    (projectId && projectId !== GLOBAL_CHAT_ID ? projectId : null) ||
    (initialProjectId && initialProjectId !== GLOBAL_CHAT_ID ? initialProjectId : null);

  const targetProjectId = isGlobal ? GLOBAL_CHAT_ID : resolvedProjectId;

  // Keep global inquiries loaded in real-time so the sidebar always shows 1-on-1 client inquiry cards
  const globalChat = useProjectChat({ projectId: GLOBAL_CHAT_ID });
  const projectChat = useProjectChat({
    projectId: !isGlobal ? targetProjectId : null,
  });

  const [initialGlobalLastRead, setInitialGlobalLastRead] = useState<number | null>(null);
  if (!globalChat.isLoading && initialGlobalLastRead === null) {
    setInitialGlobalLastRead(globalChat.lastReadId || 0);
  }

  const activeChat = isGlobal ? globalChat : projectChat;
  const {
    messages: dbMessages,
    lastReadId,
    isLoading: isDbLoading,
    sendMessage: sendDbMessage,
    toggleLike: toggleDbLike,
    editMessage: editDbMessage,
    deleteMessage: deleteDbMessage,
    markAsRead,
  } = activeChat;

  // Group global messages into 1-on-1 Client Inquiry threads
  const { inquiryThreads, messageClientMap } = useMemo(() => {
    const rawGlobal = globalChat.messages || [];
    const gLastRead = initialGlobalLastRead ?? (globalChat.lastReadId || 0);
    const msgToClient = new Map<number, string>();
    const threadsMap = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        clientEmail: string | null;
        clientAvatarUrl: string | null;
        lastMessageAt: string;
        lastMessagePreview: string;
        unreadCount: number;
        messageCount: number;
        lastChatBy: string | null;
      }
    >();

    // Index known clients from projects for richer name/email/projectCount display
    const projectClientInfo = new Map<
      string,
      { name: string; email: string | null; count: number }
    >();
    initialProjects.forEach((p) => {
      if (!p.userId) return;
      const existing = projectClientInfo.get(p.userId);
      if (existing) {
        existing.count += 1;
      } else {
        projectClientInfo.set(p.userId, {
          name: p.clientName || p.channelName || 'Creator',
          email: p.email || null,
          count: 1,
        });
      }
    });

    let lastSeenClientId: string | null = null;
    for (const m of rawGlobal) {
      const isStaff = m.sender?.role === 'admin' || m.sender?.role === 'manager';
      const resolvedClientId: string | null =
        m.clientUserId || (!isStaff ? m.senderId : lastSeenClientId);

      if (!resolvedClientId) continue;
      if (!isStaff) {
        lastSeenClientId = resolvedClientId;
      }
      msgToClient.set(m.id, resolvedClientId);

      const projInfo = projectClientInfo.get(resolvedClientId);
      const senderName = !isStaff ? m.sender?.name?.trim() : null;
      const senderEmail = !isStaff ? m.sender?.email?.trim() : null;
      const senderAvatar = !isStaff ? m.sender?.avatarUrl || null : null;
      const staffMemberName = isStaff
        ? m.sender?.staffName?.trim() || m.sender?.email?.split('@')[0] || null
        : null;

      const existing = threadsMap.get(resolvedClientId);
      const isCurrentStaff = isStaff && m.senderId === user?.id;
      const previewPrefix = isCurrentStaff
        ? 'You: '
        : isStaff && staffMemberName
          ? `${staffMemberName}: `
          : '';
      const rawText =
        m.body?.trim() ||
        (m.attachments && m.attachments.length > 0 ? 'Sent an attachment' : '');
      const preview = rawText ? `${previewPrefix}${rawText}` : 'Sent a message';

      const clientLastRead =
        clientReadMap[resolvedClientId] !== undefined
          ? Math.max(clientReadMap[resolvedClientId] || 0, 0)
          : gLastRead;

      if (!existing) {
        threadsMap.set(resolvedClientId, {
          clientId: resolvedClientId,
          clientName: senderName || projInfo?.name || 'Creator',
          clientEmail: senderEmail || projInfo?.email || null,
          clientAvatarUrl: senderAvatar,
          lastMessageAt: m.createdAt,
          lastMessagePreview: preview,
          unreadCount: !isStaff && m.id > clientLastRead ? 1 : 0,
          messageCount: 1,
          lastChatBy: staffMemberName,
        });
      } else {
        if (senderName && (existing.clientName === 'Creator' || !existing.clientName)) {
          existing.clientName = senderName;
        }
        if (senderEmail && !existing.clientEmail) {
          existing.clientEmail = senderEmail;
        }
        if (senderAvatar && !existing.clientAvatarUrl) {
          existing.clientAvatarUrl = senderAvatar;
        }
        if (staffMemberName) {
          existing.lastChatBy = staffMemberName;
        }
        existing.lastMessageAt = m.createdAt;
        existing.lastMessagePreview = preview;
        existing.messageCount += 1;
        if (!isStaff && m.id > clientLastRead) {
          existing.unreadCount += 1;
        }
      }
    }

    const list: GeneralInquiryThread[] = Array.from(threadsMap.values())
      .map((t) => ({
        ...t,
        projectCount: projectClientInfo.get(t.clientId)?.count ?? 0,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

    return { inquiryThreads: list, messageClientMap: msgToClient };
  }, [
    globalChat.messages,
    globalChat.lastReadId,
    initialGlobalLastRead,
    initialProjects,
    clientReadMap,
    user?.id,
  ]);

  // Auto-select the most recent client inquiry thread when none is selected
  const effectiveInquiryClientId = useMemo(() => {
    if (
      selectedInquiryClientId &&
      inquiryThreads.some((t) => t.clientId === selectedInquiryClientId)
    ) {
      return selectedInquiryClientId;
    }
    return inquiryThreads[0]?.clientId ?? selectedInquiryClientId ?? null;
  }, [selectedInquiryClientId, inquiryThreads]);

  const selectedInquiryThread = useMemo(
    () =>
      inquiryThreads.find((t) => t.clientId === effectiveInquiryClientId) ?? null,
    [inquiryThreads, effectiveInquiryClientId]
  );

  const activeInquiryMaxMsgId = useMemo(() => {
    if (!isGlobal || !effectiveInquiryClientId) return 0;
    const rawGlobal = globalChat.messages || [];
    let maxId = 0;
    for (const m of rawGlobal) {
      const cid = m.clientUserId || messageClientMap.get(m.id);
      if (cid === effectiveInquiryClientId && m.id > maxId) {
        maxId = m.id;
      }
    }
    return maxId;
  }, [isGlobal, effectiveInquiryClientId, globalChat.messages, messageClientMap]);

  if (
    isGlobal &&
    effectiveInquiryClientId &&
    activeInquiryMaxMsgId > 0 &&
    (clientReadMap[effectiveInquiryClientId] || 0) < activeInquiryMaxMsgId
  ) {
    setClientReadMap((prev) => ({
      ...prev,
      [effectiveInquiryClientId]: Math.max(
        prev[effectiveInquiryClientId] || 0,
        activeInquiryMaxMsgId
      ),
    }));
  }

  // Persist per-client inquiry read state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(INQUIRY_READ_STORAGE_KEY, JSON.stringify(clientReadMap));
    } catch {
      // Ignore storage quota errors
    }
  }, [clientReadMap]);

  // Resolve real-time lastChatBy for the active project thread from loaded dbMessages or fallback to project record
  const activeProjectLastChatBy = useMemo(() => {
    if (isGlobal || !activeProject) return null;
    const rawMsgs = dbMessages || [];
    for (let i = rawMsgs.length - 1; i >= 0; i--) {
      const m = rawMsgs[i];
      if (m.projectId !== activeProject.id) continue;
      if (m.sender?.role === 'admin' || m.sender?.role === 'manager') {
        const name = m.sender?.staffName?.trim() || m.sender?.email?.split('@')[0];
        if (name) return name;
      }
    }
    return activeProject.lastChatBy ?? null;
  }, [isGlobal, activeProject, dbMessages]);

  // Mark messages as read when active
  useEffect(() => {
    if (!targetProjectId) return;
    if (isGlobal) {
      if (activeInquiryMaxMsgId > 0) {
        markAsRead(activeInquiryMaxMsgId);
      }
    } else {
      markAsRead();
    }
  }, [targetProjectId, isGlobal, activeInquiryMaxMsgId, markAsRead, dbMessages]);

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setReplyingTo(null);
  };

  const handleToggleLike = async (messageId: string) => {
    const adminName = 'Studio Team';
    const numericId = parseInt(messageId, 10);
    if (targetProjectId && !isNaN(numericId)) {
      try {
        await toggleDbLike(numericId, user?.id, adminName);
      } catch (err) {
        console.error('Failed to toggle like in DB:', err);
      }
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const numericId = parseInt(messageId, 10);
    if (targetProjectId && !isNaN(numericId)) {
      try {
        await deleteDbMessage(numericId);
        void queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast.success('Message deleted');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete message');
      }
    }
  };

  const handleSendMessage = async (
    text: string,
    attachments?: ChatAttachment[],
    replyTo?: ChatReplyTo
  ) => {
    if (!targetProjectId) {
      toast.error('Please select an active conversation first');
      return;
    }
    if (isGlobal && !effectiveInquiryClientId) {
      toast.error('Please select a client inquiry from the sidebar first');
      return;
    }
    const senderName = 'Studio Team';
    const clientMsgId = queueMessage(text, {
      attachments,
      replyTo,
      senderName,
      clientUserId: isGlobal ? effectiveInquiryClientId : null,
    });
    if (!clientMsgId) return;

    try {
      await sendDbMessage(
        text,
        attachments && attachments.length > 0 ? attachments : undefined,
        clientMsgId,
        replyTo || undefined,
        isGlobal ? effectiveInquiryClientId : undefined
      );
      removeMessage(clientMsgId);
      setReplyingTo(null);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reply';
      markMessageFailed(clientMsgId, msg);
      toast.error(msg);
    }
  };

  const handleRetryMessage = async (clientMsgId: string) => {
    const target = outbox.find((m) => m.clientMessageId === clientMsgId || m.id === clientMsgId);
    if (!target) return;
    removeMessage(clientMsgId);
    await handleSendMessage(target.content, target.attachments, target.replyTo);
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

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    const numericId = parseInt(messageId, 10);
    if (targetProjectId && !isNaN(numericId)) {
      try {
        await editDbMessage(numericId, newContent);
        toast.success('Message updated');
        setEditingMessage(null);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to update message');
      }
    }
  };

  const displayMessages: ChatMessage[] = useMemo(() => {
    if (!targetProjectId) {
      return [];
    }
    const clientName = isGlobal
      ? selectedInquiryThread?.clientName || 'Creator'
      : activeProject?.clientName || 'Client';

    const scopedDb = (dbMessages || []).filter((m) => {
      if (m.projectId !== targetProjectId) return false;
      if (!isGlobal) return true;
      if (!effectiveInquiryClientId) return false;
      const mappedClient = m.clientUserId || messageClientMap.get(m.id);
      return mappedClient === effectiveInquiryClientId;
    });

    const effectiveLastReadId =
      isGlobal && effectiveInquiryClientId
        ? clientReadMap[effectiveInquiryClientId] ?? lastReadId
        : lastReadId;
    const mappedDb = scopedDb.map((m) =>
      mapProjectChatMessage(m, { clientName, lastReadId: effectiveLastReadId })
    );

    const confirmedClientIds = new Set(
      scopedDb.map((m) => m.clientMessageId).filter(Boolean)
    );
    const pendingOptimistic = outbox
      .filter(
        (m: ChatMessage) =>
          m.projectId === targetProjectId &&
          (!isGlobal || !m.clientUserId || m.clientUserId === effectiveInquiryClientId) &&
          m.clientMessageId &&
          !confirmedClientIds.has(m.clientMessageId) &&
          (m.status === 'sending' || m.status === 'failed')
      )
      .map((m: ChatMessage) => ({
        ...m,
        sender: 'agent' as const,
        staffName: m.staffName || user?.name?.trim() || null,
      }));

    return [...mappedDb, ...pendingOptimistic];
  }, [
    isGlobal,
    targetProjectId,
    dbMessages,
    lastReadId,
    activeProject,
    outbox,
    effectiveInquiryClientId,
    selectedInquiryThread,
    messageClientMap,
    clientReadMap,
    user?.name,
  ]);

  return (
    <>
      <div className="border-0 bg-card overflow-hidden flex flex-col md:flex-row w-full h-full max-h-full flex-1 min-h-0">
        {/* 1. Left Sidebar: Project Sessions & Global Desk (reusable ChatProjectSidebar) */}
        <div
          className={cn(
            'w-full md:w-[320px] lg:w-[360px] shrink-0 border-r border-border/80 bg-secondary/15 flex flex-col min-h-0 h-full max-h-full overflow-hidden',
            showMobileThread ? 'hidden md:flex' : 'flex'
          )}
        >
          <ChatProjectSidebar
            projects={initialProjects}
            activeProjectId={projectId || ''}
            unreadCounts={unreadCounts}
            inquiryThreads={inquiryThreads}
            activeInquiryClientId={effectiveInquiryClientId}
            isInquiriesLoading={globalChat.isLoading}
            onSelectInquiryClient={(clientId) => {
              setSelectedInquiryClientId(clientId);
              setActiveProjectId(GLOBAL_CHAT_ID);
              setShowMobileThread(true);
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.set('thread', GLOBAL_CHAT_ID);
                url.searchParams.set('client', clientId);
                window.history.replaceState(null, '', url.pathname + url.search);
              }
            }}
            onSelectProject={(id) => {
              setActiveProjectId(id);
              setShowMobileThread(true);
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                if (id === GLOBAL_CHAT_ID) {
                  url.searchParams.set('thread', GLOBAL_CHAT_ID);
                  if (effectiveInquiryClientId) {
                    url.searchParams.set('client', effectiveInquiryClientId);
                  }
                } else {
                  url.searchParams.set('thread', id);
                  url.searchParams.delete('client');
                }
                window.history.replaceState(null, '', url.pathname + url.search);
              }
            }}
            viewerRole="admin"
            className="h-full border-0"
          />
        </div>

        {/* 2. Right Column: Active Thread & Admin Composer */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 min-h-0 h-full max-h-full overflow-hidden bg-background',
            !showMobileThread ? 'hidden md:flex' : 'flex'
          )}
        >
          {/* Active Conversation Header (Identical theme & layout tokens to client view) */}
          <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-0 h-auto flex flex-col justify-center gap-1">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowMobileThread(false)}
                  className="md:hidden size-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                {isGlobal ? (
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    {selectedInquiryThread ? (
                      <Avatar className="size-7 shrink-0 rounded-full border border-amber-400/35 shadow-2xs">
                        {selectedInquiryThread.clientAvatarUrl && (
                          <AvatarImage
                            src={selectedInquiryThread.clientAvatarUrl}
                            alt={selectedInquiryThread.clientName}
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <AvatarFallback className="text-2xs font-bold bg-amber-400/15 text-brand-text dark:text-amber-300">
                          {getInitials(selectedInquiryThread.clientName)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="flex size-7 items-center justify-center rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 shrink-0 shadow-2xs border border-amber-400/25">
                        <MessageSquare className="size-3.5" />
                      </span>
                    )}
                    <span className="text-sm font-bold tracking-tight text-foreground truncate">
                      {selectedInquiryThread
                        ? selectedInquiryThread.clientName
                        : 'General Inquiries'}
                    </span>
                    <Badge
                      variant="gold"
                      className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0 h-4"
                    >
                      General Inquiry
                    </Badge>
                    {selectedInquiryThread &&
                      typeof selectedInquiryThread.projectCount === 'number' &&
                      selectedInquiryThread.projectCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-3xs font-mono font-semibold px-1.5 py-0 h-4 border-amber-400/30 text-brand-text dark:text-amber-300 bg-amber-400/10 rounded-md"
                        >
                          {selectedInquiryThread.projectCount}{' '}
                          {selectedInquiryThread.projectCount === 1
                            ? 'Project'
                            : 'Projects'}
                        </Badge>
                      )}
                  </div>
                ) : (
                  activeProject && (
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-mono text-xs font-bold tracking-tight text-foreground bg-secondary/80 dark:bg-secondary/60 px-2 py-0.5 rounded border border-border/80 shrink-0">
                        {activeProject.projectCode}
                      </span>
                      <TooltipProvider delay={200}>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="text-foreground font-bold text-sm truncate max-w-[200px] sm:max-w-[400px] cursor-default" />
                            }
                          >
                            {activeProject.channelName && activeProject.channelName !== activeProject.clientName
                              ? activeProject.channelName
                              : activeProject.clientName || activeProject.packageName || 'Project Workspace'}
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" className="px-2.5 py-1.5 text-2xs">
                            <span>
                              <span className="text-zinc-400 font-medium">
                                {activeProject.channelName && activeProject.channelName !== activeProject.clientName
                                  ? 'Channel / Brand:'
                                  : activeProject.clientName
                                    ? 'Client:'
                                    : 'Package:'}
                              </span>{' '}
                              <span className="font-semibold text-white">
                                {activeProject.channelName && activeProject.channelName !== activeProject.clientName
                                  ? activeProject.channelName
                                  : activeProject.clientName || activeProject.packageName || 'Project Workspace'}
                              </span>
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-3xs sm:text-2xs font-semibold px-1.5 py-0 h-4 shrink-0 rounded-md',
                          getProjectStatusBadgeClass(activeProject.status)
                        )}
                      >
                        {getProjectStatusLabel(activeProject.status)}
                      </Badge>
                    </div>
                  )
                )}
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {isGlobal &&
                  selectedInquiryThread &&
                  (selectedInquiryThread.projectCount || 0) > 0 && (
                    <Link
                      href={`/management/projects?search=${encodeURIComponent(
                        selectedInquiryThread.clientEmail ||
                          selectedInquiryThread.clientName
                      )}`}
                      title="View this client's projects"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-text dark:text-amber-400 hover:text-amber-500 bg-amber-400/10 hover:bg-amber-400/15 dark:bg-amber-400/15 dark:hover:bg-amber-400/25 px-2.5 py-1 rounded-md border border-amber-400/25 transition-colors cursor-pointer"
                    >
                      <span>Client Projects</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                {!isGlobal && activeProject && (
                  <Link
                    href={`/management/projects?project=${activeProject.id}`}
                    title="View project in management table"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-text dark:text-amber-400 hover:text-amber-500 bg-amber-400/10 hover:bg-amber-400/15 dark:bg-amber-400/15 dark:hover:bg-amber-400/25 px-2.5 py-1 rounded-md border border-amber-400/25 transition-colors cursor-pointer"
                  >
                    <span>View Project</span>
                    <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Subtitle Line */}
            {isGlobal ? (
              selectedInquiryThread ? (
                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-2xs text-muted-foreground min-w-0 pl-0 sm:pl-9">
                  <span className="font-semibold text-foreground/90 truncate">
                    Client: {selectedInquiryThread.clientName}
                  </span>
                  {selectedInquiryThread.clientEmail && (
                    <span className="text-muted-foreground/70 truncate">
                      ({selectedInquiryThread.clientEmail})
                    </span>
                  )}
                  <span className="text-muted-foreground/40">·</span>
                  <span>
                    1-on-1 General Inquiry ({selectedInquiryThread.messageCount}{' '}
                    {selectedInquiryThread.messageCount === 1
                      ? 'message'
                      : 'messages'}
                    )
                  </span>
                  {selectedInquiryThread.lastChatBy && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MessageSquare className="size-2.5 text-amber-500/80 shrink-0" />
                        <span>
                          Last chat by{' '}
                          <span className="font-semibold text-foreground/90">
                            ({selectedInquiryThread.lastChatBy})
                          </span>
                        </span>
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-2xs text-muted-foreground truncate pl-0 sm:pl-9">
                  Select a client from the left sidebar to view and reply to their general inquiry
                </p>
              )
            ) : (
              activeProject && (
                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-2xs text-muted-foreground min-w-0">
                  <span className="font-semibold text-foreground/90 truncate">
                    Client: {activeProject.clientName}
                  </span>
                  <span className="text-muted-foreground/60 hidden sm:inline">({activeProject.email})</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground font-medium hidden xs:inline">
                    {activeProject.packageName}
                  </span>
                  <span className="text-muted-foreground/40 hidden xs:inline">·</span>
                  <span className="inline-flex items-center font-mono tabular-nums font-bold text-brand-text dark:text-amber-400 bg-amber-400/10 dark:bg-amber-400/20 px-1.5 py-0.2 rounded border border-amber-400/25 shrink-0 text-3xs">
                    {activeProject.packageCredits || activeProject.usedCredits || 0} CR
                  </span>
                  {activeProject.packagePrice > 0 && (
                    <>
                      <span className="text-muted-foreground/40 hidden sm:inline">·</span>
                      <span className="font-mono tabular-nums text-foreground/80 font-medium shrink-0 hidden sm:inline">
                        ${activeProject.packagePrice.toLocaleString()} USD
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground/40">·</span>
                  {getPaymentBadge(activeProject.paymentStatus)}
                  {activeProjectLastChatBy && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MessageSquare className="size-2.5 text-amber-500/80 shrink-0" />
                        <span>
                          Last chat by{' '}
                          <span className="font-semibold text-foreground/90">
                            ({activeProjectLastChatBy})
                          </span>
                        </span>
                      </span>
                    </>
                  )}
                </div>
              )
            )}
          </div>

          {/* 3. Message Thread (Centered comfortable reading width) */}
          <div className="flex-1 min-h-0 bg-card/60 flex flex-col overflow-hidden">
            <ChatMessageList
              messages={displayMessages}
              isLoading={isDbLoading}
              projectId={
                isGlobal
                  ? `global:${effectiveInquiryClientId || 'none'}`
                  : targetProjectId || 'none'
              }
              unreadCount={unreadBelowScroll}
              onClearUnread={clearUnreadBelowScroll}
              onIncrementUnread={incrementUnreadBelowScroll}
              className="h-full"
              contentClassName="p-4 sm:p-6 gap-3 max-w-4xl mx-auto w-full"
              emptyTitle={
                isGlobal
                  ? selectedInquiryThread
                    ? `General Inquiry with ${selectedInquiryThread.clientName}`
                    : 'No General Inquiries Selected'
                  : 'No messages in this project yet'
              }
              emptyDescription={
                isGlobal
                  ? selectedInquiryThread
                    ? `Write a reply below to answer ${selectedInquiryThread.clientName}'s general questions.`
                    : 'When clients send a message in "Ask the Studio Team", each client appears as a separate 1-on-1 conversation in the Inquiries tab on the left.'
                  : `Write a message below to coordinate deliverables, feedback, and project status with ${
                      activeProject?.channelName || activeProject?.clientName || 'the client'
                    }.`
              }
              renderMessage={(msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  currentUserId={user?.id || 'admin'}
                  viewerRole="admin"
                  onPreviewAttachment={(att) => setPreviewAttachment(att)}
                  onReply={
                    canReply
                      ? (m) => {
                          setEditingMessage(null);
                          setReplyingTo({
                            id: m.id,
                            senderName: m.senderName,
                            senderRole: m.senderRole,
                            content: m.content,
                          });
                        }
                      : undefined
                  }
                  onToggleLike={canReply ? handleToggleLike : undefined}
                  onStartEdit={canReply ? handleStartEdit : undefined}
                  onDelete={canReply ? handleDeleteMessage : undefined}
                  onScrollToMessage={handleScrollToMessage}
                  onRetry={canReply ? handleRetryMessage : undefined}
                />
              )}
            />
          </div>

          {/* 4. Admin Composer (Centered to match message feed) */}
          <div className="px-4 py-3 border-t border-border/70 bg-card/90 shrink-0">
            <div className="max-w-4xl mx-auto w-full">
              {canReply ? (
                <ChatInputBar
                  onSendMessage={handleSendMessage}
                  replyingTo={replyingTo}
                  onCancelReply={() => setReplyingTo(null)}
                  editingMessage={editingMessage}
                  onCancelEdit={() => setEditingMessage(null)}
                  onSaveEdit={handleSaveEdit}
                  isGlobal={isGlobal}
                  projectId={
                    isGlobal && effectiveInquiryClientId
                      ? `global:${effectiveInquiryClientId}`
                      : targetProjectId || undefined
                  }
                  activeProjectCode={isGlobal ? undefined : activeProject?.projectCode}
                  activeProjectName={
                    isGlobal
                      ? selectedInquiryThread?.clientName
                      : activeProject?.channelName || activeProject?.packageName
                  }
                  placeholder={
                    isGlobal
                      ? selectedInquiryThread
                        ? `Reply to ${selectedInquiryThread.clientName} (General Inquiry)...`
                        : 'Select a client inquiry from the left sidebar to reply...'
                      : undefined
                  }
                  viewerRole="admin"
                />
              ) : (
                <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border/80 bg-secondary/40 text-xs text-muted-foreground font-medium">
                  <span>Read-only Viewer access — only Owner and Manager accounts can reply to client messages.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attachment Preview Lightbox Modal */}
      <ChatAttachmentModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
}
