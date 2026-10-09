'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useStudioChat, useChatStore, ChatAttachment, SAMPLE_REFERENCES, GLOBAL_META, ChatMessage } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';
import { useProjectChat } from '@/lib/chat/useProjectChat';
import { useProjectsQuery } from '@/lib/queries/projects';
import { toast } from 'sonner';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInputBar } from './ChatInputBar';
import { ChatAttachmentModal } from './ChatAttachmentModal';
import { ChatMessageList } from './ChatMessageList';
import { ChatProjectSidebar } from './ChatProjectSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item';
import { cn, formatChatTimestamp } from '@/lib/utils';
import {
  Sparkles,
  ShieldCheck,
  Coins,
  FolderKanban,
  ImageIcon,
  Clock,
  ExternalLink,
  CheckCircle2,
  Eye,
  MessageSquare,
  Search,
  Filter,
} from 'lucide-react';

export function ChatFullView() {
  const {
    projectId,
    isGlobal,
    projectMeta,
    projectMessages,
    messages: storeMessages,
    agent,
    isTyping,
    unreadCounts,
    unreadBelowScroll,
    incrementUnreadBelowScroll,
    clearUnreadBelowScroll,
    retryMessage,
    setActiveProjectId,
    sendMessage: sendStoreMessage,
    toggleReaction,
    markAllAsRead,
  } = useStudioChat();

  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];

  // Derive active project metadata directly from TanStack Query without duplicating state into Zustand
  const activeProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  const { user } = useUserStore();
  const targetProjectId = isGlobal || !user?.email || !activeProject || projectId === 'proj-demo-1' ? null : projectId;

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
    if (!isGlobal && projectId) {
      markAsRead();
    } else {
      markAllAsRead();
    }
  }, [projectId, isGlobal, markAsRead, markAllAsRead, dbMessages]);

  const displayMessages: ChatMessage[] = useMemo(() => {
    if (isGlobal || !projectId) {
      return storeMessages;
    }
    if (dbMessages && dbMessages.length > 0) {
      const mappedDb: ChatMessage[] = dbMessages.map((m) => ({
        id: String(m.id),
        clientMessageId: m.clientMessageId || undefined,
        projectId: m.projectId,
        sender: m.kind === 'system' ? 'system' : (m.sender?.role === 'admin' ? 'agent' : 'client'),
        senderName: m.sender?.role === 'admin' ? 'Sarah Miller' : (activeProject?.clientName || 'You (Creator)'),
        senderRole: m.sender?.role === 'admin' ? 'Senior Creative Producer' : 'Creator',
        content: m.body,
        timestamp: formatChatTimestamp(m.createdAt),
        isRead: m.id <= lastReadId,
        status: 'sent',
        attachments: (m.attachments || []).map((att) => ({
          id: att.id,
          name: att.fileName,
          size: `${Math.round(att.fileSize / 1024)} KB`,
          type: att.mimeType.startsWith('image/') ? 'image' : 'file',
          url: att.url || '',
          previewUrl: att.mimeType.startsWith('image/') ? att.url || '' : undefined,
        })),
      }));

      // Include pending/failed optimistic messages from store that haven't landed in dbMessages yet
      const confirmedClientIds = new Set(
        dbMessages.map((m) => m.clientMessageId).filter(Boolean)
      );
      const pendingOptimistic = storeMessages.filter(
        (m) =>
          m.clientMessageId &&
          !confirmedClientIds.has(m.clientMessageId) &&
          (m.status === 'sending' || m.status === 'failed')
      );

      return [...mappedDb, ...pendingOptimistic];
    }
    return storeMessages;
  }, [isGlobal, projectId, storeMessages, dbMessages, lastReadId, activeProject]);

  const handleSendMessage = async (text: string, attachments?: ChatAttachment[]) => {
    // 1. Send optimistically into Zustand store (enforces single-flight lock, clears draft, sets status: 'sending')
    const clientMsgId = await sendStoreMessage(text, attachments);

    // 2. If connected to a real Supabase DB project, dispatch to DB API endpoint
    if (!isGlobal && projectId && targetProjectId && clientMsgId) {
      try {
        await sendDbMessage(text, attachments, clientMsgId);
        useChatStore.getState().reconcileMessage(projectId, clientMsgId, { status: 'sent' });
      } catch (err: any) {
        useChatStore.getState().markMessageFailed(projectId, clientMsgId, err.message || 'Failed to send');
        toast.error(err.message || 'Failed to send message');
      }
    }
  };

  // Extract unique attachments from the currently active project chat
  const displayAttachments = useMemo(() => {
    const rawAttachments: ChatAttachment[] = displayMessages.flatMap((m) => m.attachments || []);
    const source = rawAttachments.length > 0 ? rawAttachments : SAMPLE_REFERENCES;

    const seen = new Set<string>();
    const unique: ChatAttachment[] = [];
    for (const att of source) {
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
            <span>Project-Based Creative Studio Communications</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Messages &amp; Project Discussion
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Direct project discussion threads, moodboards, asset approvals, and milestone updates.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/new-project">
            <Button variant="outline" size="sm" className="h-8.5 text-xs font-semibold gap-1.5 rounded-lg sm:rounded-xl cursor-pointer">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="secondary" size="sm" className="h-8.5 text-xs font-semibold gap-1.5 rounded-lg sm:rounded-xl cursor-pointer">
              <FolderKanban className="w-3.5 h-3.5 text-amber-600" />
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
          {/* Producer Profile Card */}
          <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="relative">
                <Avatar className="w-12 h-12 rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-amber-600/30 text-amber-800 dark:text-amber-300 font-extrabold text-sm shadow-md">
                  <AvatarFallback>{agent.avatarInitials}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                </span>
              </div>

              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-foreground truncate">{agent.name}</h3>
                  <Badge variant="gold" className="text-2xs font-mono font-bold uppercase tracking-wider py-0 px-1.5 h-4">
                    Lead
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                <span className="inline-flex items-center gap-1 text-2xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Online & Dedicated
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
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Response Time
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">~2 minutes</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Mode
                </span>
                <span className="font-medium text-foreground">Project-Isolated</span>
              </div>
            </div>
          </Card>

          {/* Project Conversation Threads Directory using ChatProjectSidebar */}
          <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden h-[380px]">
            <ChatProjectSidebar
              projects={projects}
              activeProjectId={projectId}
              unreadCounts={unreadCounts}
              projectMessages={projectMessages}
              onSelectProject={setActiveProjectId}
              isLoading={projectsQuery.isPending}
              className="h-full border-0 bg-transparent"
            />
          </div>

          {/* Reference Moodboards or Studio Overview */}
          {isGlobal ? (
            <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Studio Concierge
                </span>
              </div>
              <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                <p>
                  This is your primary channel with Sarah Miller for custom creative quotes, credit inquiries, package advisory, and account support.
                </p>
                <div className="pt-2 border-t border-border/70 space-y-2 font-medium text-2xs text-foreground/90">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Dedicated Senior Lead Producer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>12-Month Wallet Credit Rollover</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Rapid 48h Concept Turnaround</span>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-2xs font-bold text-foreground uppercase tracking-wider">
                    Project Moodboards ({displayAttachments.length})
                  </span>
                </div>
                <span className="text-2xs text-muted-foreground font-mono tabular-nums">{displayMeta.projectCode}</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {displayAttachments.map((att, idx) => (
                  <div
                    key={`${att.id || 'att'}-${idx}`}
                    onClick={() => setPreviewAttachment(att)}
                    className="group relative rounded-lg overflow-hidden border border-border/70 bg-black/20 cursor-pointer aspect-video hover:border-amber-500/60 transition-all"
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
              <p className="text-2xs text-muted-foreground/80 leading-normal">
                Visual moodboards uploaded for {displayMeta.projectCode}. Click any frame to zoom in.
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
                  <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 shadow-2xs">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base font-bold tracking-tight text-foreground">Global Chat</span>
                      <span className="flex size-2 rounded-full bg-emerald-500 inline-block align-middle" />
                      <span className="text-3xs uppercase tracking-wider font-semibold text-amber-700/80 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/20">
                        Concierge
                      </span>
                    </div>
                    <p className="text-2xs text-muted-foreground mt-0.5 leading-normal truncate">
                      Replies in ~2 mins · Packages, credits & studio support
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-0 h-auto flex flex-col justify-center gap-1">
                {/* Line 1: Code + Package + Status Badge (Left) & Milestone Tracker (Right) */}
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
                    className="inline-flex items-center gap-1 text-2xs sm:text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline shrink-0 bg-amber-500/10 dark:bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/20 transition-colors"
                  >
                    <span className="hidden min-[380px]:inline">Milestone Tracker</span>
                    <span className="min-[380px]:hidden">Tracker</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </Link>
                </div>

                {/* Line 2: Client Info · Credits Badge · Price (graceful wrapping on small screens) */}
                <div className="flex items-center gap-x-1.5 gap-y-0.5 text-2xs text-muted-foreground flex-wrap min-w-0">
                  <span className="inline-flex items-center gap-1 truncate max-w-[140px] sm:max-w-[260px]">
                    Client: <b className="text-foreground font-medium truncate">{displayMeta.clientName}</b>
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="inline-flex items-center font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/25 shrink-0">
                    {displayMeta.credits || 660} CR
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
                isTyping={isTyping}
                agentName={agent.name}
                isGlobal={isGlobal}
                projectId={projectId}
                unreadCount={unreadBelowScroll}
                onClearUnread={clearUnreadBelowScroll}
                onIncrementUnread={incrementUnreadBelowScroll}
                contentClassName="px-5 py-4 gap-3"
                renderMessage={(msg) => (
                  <ChatMessageItem
                    message={msg}
                    onPreviewAttachment={setPreviewAttachment}
                    onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                    onRetry={retryMessage}
                  />
                )}
              />
            </div>

            {/* Input Bar Footer */}
            <div className="px-4 py-3 border-t border-border/70 bg-card/90 shrink-0">
              <ChatInputBar
                onSendMessage={handleSendMessage}
                isTyping={isTyping}
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
