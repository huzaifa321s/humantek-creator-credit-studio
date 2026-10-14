'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/lib/utils';
import {
  Sparkles,
  Plus,
  ShieldCheck,
  FolderKanban,
  ImageIcon,
  Clock,
  ExternalLink,
  Mail,
  Eye,
  MessageSquare,
} from 'lucide-react';

const EMPTY_PROJECTS: ProjectRecord[] = [];

export function ChatFullView() {
  const {
    projectId,
    isGlobal,
    outbox,
    unreadCounts,
    unreadBelowScroll,
    incrementUnreadBelowScroll,
    clearUnreadBelowScroll,
    queueMessage,
    removeMessage,
    markMessageFailed,
    setActiveProjectId,
  } = useStudioChat();

  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

  const [syncedThreadId, setSyncedThreadId] = useState(projectId);
  if (syncedThreadId !== projectId) {
    setSyncedThreadId(projectId);
    setReplyingTo(null);
    setEditingMessage(null);
    setPreviewAttachment(null);
  }

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;

  const projectFromList = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

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

  // Mark active conversation as read
  useEffect(() => {
    if (targetProjectId) {
      markAsRead();
    }
  }, [targetProjectId, markAsRead, dbMessages]);

  const displayMessages: ChatMessage[] = useMemo(() => {
    if (!targetProjectId) {
      return [];
    }
    const clientName = isGlobal ? (user?.name || 'You') : (activeProject?.clientName || user?.name || 'You');
    const scopedDb = (dbMessages || []).filter((m) => m.projectId === targetProjectId);
    const mappedDb = scopedDb.map((m) =>
      mapProjectChatMessage(m, { clientName, lastReadId })
    );

    const confirmedClientIds = new Set(
      scopedDb.map((m) => m.clientMessageId).filter(Boolean)
    );
    const pendingOptimistic = outbox.filter(
      (m: ChatMessage) =>
        m.projectId === targetProjectId &&
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

  // Real attachments uploaded in the active conversation (excluding soft-deleted messages)
  const displayAttachments = useMemo(() => {
    const rawAttachments: ChatAttachment[] = displayMessages
      .filter((m) => !m.isDeleted)
      .flatMap((m) => m.attachments || []);
    const seen = new Set<string>();
    const unique: ChatAttachment[] = [];
    for (const att of rawAttachments) {
      const identifier = att.url || att.id || att.name;
      if (identifier && !seen.has(identifier)) {
        seen.add(identifier);
        unique.push(att);
      }
    }
    return unique;
  }, [displayMessages]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2 text-2xs sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Creative Studio Communications</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Messages &amp; Project Discussion
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Direct collaboration with our studio team, revision notes, file sharing, and project tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/new-project">
            <Button variant="outline" size="sm" className="h-8.5 text-xs font-semibold gap-1.5 rounded-lg sm:rounded-xl cursor-pointer">
              <Plus className="w-3.5 h-3.5 stroke-[2.5] text-brand-text dark:text-amber-400" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="secondary" size="sm" className="h-8.5 text-xs font-semibold gap-1.5 rounded-lg sm:rounded-xl cursor-pointer">
              <FolderKanban className="w-3.5 h-3.5 text-brand-text dark:text-amber-400" />
              <span>Projects</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main 2-Column Chat Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: PROJECT DIRECTORY & ASSETS                   */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 order-2 lg:order-1">
          {/* Studio Team Card */}
          <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-start gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-brand-text dark:text-amber-400 shadow-xs border border-amber-400/30">
                <MessageSquare className="size-5" />
              </span>

              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-foreground truncate">Studio Team</h3>
                  <Badge variant="gold" className="text-2xs font-mono font-bold uppercase tracking-wider py-0 px-1.5 h-4">
                    Live
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">Project Messages &amp; Direct Support</p>
                <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground font-medium">
                  Direct Studio Line
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Studio Hours
                </span>
                <span className="font-medium text-foreground">Mon–Fri · 9AM–7PM EST</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Mode
                </span>
                <span className="font-medium text-foreground">Project-Isolated</span>
              </div>
            </div>
          </Card>

          {/* Project Conversation Threads Directory */}
          <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden h-[380px]">
            <ChatProjectSidebar
              projects={projects}
              activeProjectId={projectId}
              unreadCounts={unreadCounts}
              onSelectProject={(id) => {
                setActiveProjectId(id);
                if (typeof window !== 'undefined' && window.location.pathname === '/messages') {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('thread');
                  if (id === GLOBAL_CHAT_ID) {
                    url.searchParams.delete('project');
                  } else {
                    url.searchParams.set('project', id);
                  }
                  window.history.replaceState(null, '', url.pathname + url.search);
                }
              }}
              className="h-full border-0 bg-transparent"
            />
          </div>

          {/* Reference Moodboards or Studio Overview */}
          {isGlobal ? (
            <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                <Sparkles className="w-4 h-4 text-brand-text dark:text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Need help?
                </span>
              </div>
              <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                <p>
                  Message our studio team about packages, credits, or your projects.
                </p>
                <div className="pt-2 border-t border-border/70 space-y-2 font-medium text-2xs text-foreground/90">
                  <a
                    href="mailto:support@humantek.com"
                    className="flex items-center gap-2 text-brand-text dark:text-amber-400 hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0" />
                    <span>support@humantek.com</span>
                  </a>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-brand-text dark:text-amber-400 shrink-0" />
                  <span className="text-2xs font-bold text-foreground uppercase tracking-wider">
                    Project References ({displayAttachments.length})
                  </span>
                </div>
                <span className="text-2xs text-muted-foreground font-mono tabular-nums">{displayMeta.projectCode}</span>
              </div>

              {displayAttachments.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No references shared yet
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {displayAttachments.map((att, idx) => (
                    <div
                      key={`${att.id || 'att'}-${idx}`}
                      onClick={() => setPreviewAttachment(att)}
                      className="group relative rounded-lg overflow-hidden border border-border/70 bg-black/20 cursor-pointer aspect-video hover:border-amber-400/60 transition-all"
                    >
                      {att.previewUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-2xs font-medium backdrop-blur-xs">
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-2xs text-muted-foreground/80 leading-normal">
                Files and image references shared in this project thread.
              </p>
            </Card>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: CHAT STREAM                                 */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 xl:col-span-9 order-1 lg:order-2">
          <Card className="rounded-xl border border-border/80 bg-card shadow-sm flex flex-col gap-0 py-0 h-[620px] sm:h-[700px] lg:h-[740px] max-h-[85vh] overflow-hidden">
            {/* Chat Pane Header */}
            {isGlobal ? (
              <div className="px-3.5 sm:px-5 py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-[56px] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 shrink-0 shadow-2xs">
                    <MessageSquare className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base font-bold tracking-tight text-foreground">Studio Help</span>
                    </div>
                    <p className="text-2xs text-muted-foreground mt-0.5 leading-normal truncate">
                      Packages, credits, or anything else
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-0 h-auto flex flex-col justify-center gap-1">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="font-mono text-xs font-bold tracking-tight text-foreground bg-secondary/80 dark:bg-secondary/60 px-1.5 py-0.5 rounded border border-border/70 shrink-0">
                      {displayMeta.projectCode}
                    </span>
                    <span className="text-foreground/90 font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[240px]">
                      {displayMeta.packageName}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-3xs sm:text-2xs font-medium lowercase px-1.5 py-0 h-4 shrink-0 text-muted-foreground border-border/70 rounded-md"
                    >
                      {(displayMeta.status || 'in_progress').replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </div>

                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1 text-2xs sm:text-xs font-semibold text-brand-text dark:text-amber-400 hover:underline shrink-0 bg-amber-400/10 dark:bg-amber-400/15 px-2 py-0.5 rounded-md border border-amber-400/25 transition-colors"
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

            {/* Chat Messages Body */}
            <div className="flex-1 min-h-0 bg-card/60">
              <ChatMessageList
                messages={displayMessages}
                isLoading={isDbLoading}
                projectId={projectId}
                unreadCount={unreadBelowScroll}
                onClearUnread={clearUnreadBelowScroll}
                onIncrementUnread={incrementUnreadBelowScroll}
                contentClassName="px-5 py-4 gap-3"
                renderMessage={(msg) => (
                  <ChatMessageItem
                    message={msg}
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

            <div className="px-4 py-3 border-t border-border/70 bg-card/90 shrink-0">
              <ChatInputBar
                onSendMessage={handleSendMessage}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                editingMessage={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
                onSaveEdit={handleSaveEdit}
                isGlobal={isGlobal}
                projectId={projectId}
                activeProjectCode={isGlobal ? undefined : displayMeta.projectCode}
                activeProjectName={isGlobal ? undefined : displayMeta.packageName}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Lightbox Preview Modal */}
      <ChatAttachmentModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </div>
  );
}
