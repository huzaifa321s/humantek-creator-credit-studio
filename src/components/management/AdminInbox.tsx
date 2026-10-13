'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useStudioChat, ChatMessage, GLOBAL_CHAT_ID, ChatReplyTo } from '@/lib/chatStore';
import { mapProjectChatMessage } from '@/lib/chat/mapMessage';
import { useProjectChat } from '@/lib/chat/useProjectChat';
import { useProjectsQuery, useProjectDetailQuery } from '@/lib/queries/projects';
import { useUserStore } from '@/lib/userStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatProjectSidebar } from '@/components/chat/ChatProjectSidebar';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatAttachmentModal } from '@/components/chat/ChatAttachmentModal';
import {
  ChevronLeft,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import type { ProjectRecord, ChatAttachment } from '@/types';

const EMPTY_PROJECTS: ProjectRecord[] = [];

interface AdminInboxProps {
  initialProjectId?: string | null;
}

function getPaymentBadge(status?: string) {
  switch (status) {
    case 'paid':
      return (
        <Badge
          variant="outline"
          className="text-3xs font-medium lowercase px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md"
        >
          paid
        </Badge>
      );
    case 'refunded':
      return (
        <Badge
          variant="outline"
          className="text-3xs font-medium lowercase px-1.5 py-0 h-4 border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 rounded-md"
        >
          refunded
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="text-3xs font-medium lowercase px-1.5 py-0 h-4 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md"
        >
          unpaid
        </Badge>
      );
  }
}

export function AdminInbox({ initialProjectId }: AdminInboxProps) {
  const { user } = useUserStore();
  const {
    projectId,
    isGlobal,
    setActiveProjectId,
    unreadCounts,
    unreadBelowScroll,
    incrementUnreadBelowScroll,
    clearUnreadBelowScroll,
  } = useStudioChat();

  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

  const [showMobileThread, setShowMobileThread] = useState(() => Boolean(initialProjectId));
  const [prevInitialId, setPrevInitialId] = useState(initialProjectId);
  if (prevInitialId !== initialProjectId) {
    setPrevInitialId(initialProjectId);
    if (initialProjectId) {
      setShowMobileThread(true);
    }
  }

  // Set initial project if provided and different
  useEffect(() => {
    if (initialProjectId && initialProjectId !== projectId) {
      setActiveProjectId(initialProjectId);
    }
  }, [initialProjectId, projectId, setActiveProjectId]);

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

  // Mark messages as read when active
  useEffect(() => {
    if (targetProjectId) {
      markAsRead();
    }
  }, [targetProjectId, markAsRead, dbMessages]);

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setReplyingTo(null);
  };

  const handleToggleLike = async (messageId: string) => {
    const adminName = user?.name || 'Humantek Studio';
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
    try {
      await sendDbMessage(
        text,
        attachments && attachments.length > 0 ? attachments : undefined,
        undefined,
        replyTo || undefined
      );
      setReplyingTo(null);
      toast.success('Reply sent to client');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
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
    const clientName = isGlobal ? 'Creator' : activeProject?.clientName || 'Client';
    return (dbMessages || []).map((m) =>
      mapProjectChatMessage(m, { clientName, lastReadId })
    );
  }, [isGlobal, targetProjectId, dbMessages, lastReadId, activeProject]);

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
            onSelectProject={(id) => {
              setActiveProjectId(id);
              setShowMobileThread(true);
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
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 shrink-0 shadow-2xs">
                      <MessageSquare className="size-3.5" />
                    </span>
                    <span className="text-sm font-bold tracking-tight text-foreground truncate">
                      General Inquiries
                    </span>
                    <Badge variant="gold" className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0 h-4">
                      General
                    </Badge>
                  </div>
                ) : (
                  activeProject && (
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-mono text-xs font-bold tracking-tight text-brand-text dark:text-amber-400 bg-amber-400/10 dark:bg-amber-400/15 px-2 py-0.5 rounded border border-amber-400/30 shrink-0">
                        {activeProject.projectCode}
                      </span>
                      <span className="text-foreground font-bold text-sm truncate max-w-[200px] sm:max-w-[400px]">
                        {activeProject.channelName && activeProject.channelName !== activeProject.clientName
                          ? activeProject.channelName
                          : activeProject.clientName || activeProject.packageName || 'Project Workspace'}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-3xs sm:text-2xs font-medium lowercase px-1.5 py-0 h-4 shrink-0 text-muted-foreground border-border/70 rounded-md"
                      >
                        {activeProject.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </div>
                  )
                )}
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2 shrink-0">
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
              <p className="text-2xs text-muted-foreground truncate pl-0 sm:pl-9">
                General client questions and pre-order inquiries
              </p>
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
                </div>
              )
            )}
          </div>

          {/* 3. Message Thread (Centered comfortable reading width) */}
          <div className="flex-1 min-h-0 bg-card/60 flex flex-col overflow-hidden">
            <ChatMessageList
              messages={displayMessages}
              isLoading={isDbLoading}
              projectId={targetProjectId || 'none'}
              unreadCount={unreadBelowScroll}
              onClearUnread={clearUnreadBelowScroll}
              onIncrementUnread={incrementUnreadBelowScroll}
              className="h-full"
              contentClassName="p-4 sm:p-6 gap-3 max-w-4xl mx-auto w-full"
              emptyTitle={isGlobal ? 'Studio Support Desk' : 'No messages in this project yet'}
              emptyDescription={
                isGlobal
                  ? 'No support messages yet. Inquiries sent by creators in the Studio Support Desk will appear here in real time.'
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
                  onReply={(m) => {
                    setEditingMessage(null);
                    setReplyingTo({
                      id: m.id,
                      senderName: m.senderName,
                      senderRole: m.senderRole,
                      content: m.content,
                    });
                  }}
                  onToggleLike={handleToggleLike}
                  onStartEdit={handleStartEdit}
                  onDelete={handleDeleteMessage}
                />
              )}
            />
          </div>

          {/* 4. Admin Composer (Centered to match message feed) */}
          <div className="px-4 py-3 border-t border-border/70 bg-card/90 shrink-0">
            <div className="max-w-4xl mx-auto w-full">
              <ChatInputBar
                onSendMessage={handleSendMessage}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                editingMessage={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
                onSaveEdit={handleSaveEdit}
                isGlobal={isGlobal}
                projectId={targetProjectId || undefined}
                activeProjectCode={isGlobal ? undefined : activeProject?.projectCode}
                activeProjectName={
                  isGlobal ? undefined : activeProject?.channelName || activeProject?.packageName
                }
                viewerRole="admin"
              />
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
