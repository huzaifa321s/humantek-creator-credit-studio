'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ProjectRecord } from '@/types';
import { useStudioChat, ChatMessage, GLOBAL_CHAT_ID } from '@/lib/chatStore';
import { useProjectChat } from '@/lib/chat/useProjectChat';
import { useProjectsQuery } from '@/lib/queries/projects';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import {
  Search,
  Send,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Sparkles,
  Paperclip,
  ChevronLeft,
} from 'lucide-react';
import { cn, formatStudioDate, getProjectStatusLabel } from '@/lib/utils';
import { toast } from 'sonner';

interface AdminInboxProps {
  initialProjectId?: string | null;
}

export function AdminInbox({ initialProjectId }: AdminInboxProps) {
  const {
    projectId,
    isGlobal,
    messages: storeMessages,
    sendMessage: sendStoreMessage,
    toggleReaction,
    setActiveProjectId,
    unreadCounts,
    markAllAsRead,
  } = useStudioChat();

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(() => Boolean(initialProjectId));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set initial project if provided and different
  useEffect(() => {
    if (initialProjectId) {
      if (initialProjectId !== projectId) {
        setActiveProjectId(initialProjectId);
      }
      setShowMobileThread(true);
    }
  }, [initialProjectId, projectId, setActiveProjectId]);

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

  // Mark messages as read when active
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
      return dbMessages.map((m) => ({
        id: String(m.id),
        projectId: m.projectId,
        sender: m.kind === 'system' ? 'system' : (m.sender?.role === 'admin' ? 'agent' : 'client'),
        senderName: m.sender?.role === 'admin' ? 'Sarah Miller' : (activeProject?.clientName || 'Client'),
        senderRole: m.sender?.role === 'admin' ? 'Lead Creative Producer' : 'Client',
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.clientName.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        (p.channelName && p.channelName.toLowerCase().includes(q)) ||
        p.email.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = replyText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      if (!isGlobal && projectId) {
        await sendDbMessage(text);
      } else {
        sendStoreMessage(text);
      }
      setReplyText('');
      toast.success('Reply sent to client');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const clientDisplayName = activeProject
    ? activeProject.channelName || activeProject.clientName
    : isGlobal
    ? 'All Clients'
    : 'Client';

  return (
    <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs grid grid-cols-1 md:grid-cols-12 min-h-[580px] h-[calc(100vh-16rem)] max-h-[820px]">
      {/* ========================================================= */}
      {/* 1. Left Column: Client Conversation List                  */}
      {/* ========================================================= */}
      <div className={cn(
        "md:col-span-4 lg:col-span-4 border-r border-border/80 bg-secondary/15 flex flex-col min-h-0",
        showMobileThread ? "hidden md:flex" : "flex"
      )}>
        {/* Search header */}
        <div className="p-3 border-b border-border/80 bg-card/60 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background rounded-lg border-border/70"
            />
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {/* General Inquiries channel */}
          <button
            type="button"
            onClick={() => {
              setActiveProjectId(GLOBAL_CHAT_ID);
              setShowMobileThread(true);
            }}
            className={cn(
              'w-full text-left p-3 transition-colors flex items-start gap-2.5 cursor-pointer',
              isGlobal
                ? 'bg-amber-500/15 border-l-2 border-amber-500'
                : 'hover:bg-muted/50'
            )}
          >
            <Avatar className="w-8 h-8 rounded-lg border border-border bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-xs shrink-0 mt-0.5">
              <AvatarFallback>HQ</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-foreground truncate">
                  Studio General Inquiries
                </span>
                <span className="text-2xs text-muted-foreground font-mono">Live</span>
              </div>
              <p className="text-2xs text-muted-foreground truncate mt-0.5">
                Global pre-sales &amp; general studio discussion
              </p>
            </div>
          </button>

          {/* Project channels */}
          {filteredProjects.map((p) => {
            const isSelected = !isGlobal && projectId === p.id;
            const unread = unreadCounts[p.id] || 0;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveProjectId(p.id);
                  setShowMobileThread(true);
                }}
                className={cn(
                  'w-full text-left p-3 transition-colors flex items-start gap-2.5 cursor-pointer',
                  isSelected
                    ? 'bg-amber-500/15 border-l-2 border-amber-500'
                    : 'hover:bg-muted/50'
                )}
              >
                <Avatar className="w-8 h-8 rounded-lg border border-border bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold text-xs shrink-0 mt-0.5">
                  <AvatarFallback>
                    {(p.channelName || p.clientName || 'C').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-foreground truncate">
                      {p.channelName || p.clientName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.lastMessageAt && (
                        <span className="text-3xs text-muted-foreground font-mono">
                          {new Date(p.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <span className="font-mono text-2xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1 py-0.2 rounded border border-amber-300/60 dark:border-amber-800/60">
                        {p.projectCode}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-2xs text-muted-foreground truncate">
                      {p.lastMessagePreview || `${p.clientName} · ${p.packageName}`}
                    </span>

                    {unread > 0 && (
                      <Badge variant="gold" className="text-3xs px-1.5 py-0 h-4 font-bold shrink-0">
                        {unread}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No matching conversations
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. Right Column: Active Thread & Direct Admin Composer    */}
      {/* ========================================================= */}
      <div className={cn(
        "md:col-span-8 lg:col-span-8 flex flex-col min-h-0 bg-background",
        !showMobileThread ? "hidden md:flex" : "flex"
      )}>
        {/* Active conversation header */}
        <div className="p-3 sm:p-3.5 border-b border-border/80 bg-card/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowMobileThread(false)}
              className="md:hidden size-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              aria-label="Back to conversations"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Avatar className="w-8 sm:w-9 h-8 sm:h-9 rounded-lg border border-border bg-amber-100 text-amber-800 font-bold text-xs shrink-0">
              <AvatarFallback>
                {clientDisplayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground truncate">
                  {clientDisplayName}
                </h3>
                {activeProject && (
                  <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800 shrink-0">
                    {activeProject.projectCode}
                  </span>
                )}
              </div>
              <p className="text-2xs text-muted-foreground truncate">
                {activeProject
                  ? `Client: ${activeProject.clientName} · ${activeProject.email} · ${activeProject.packageName}`
                  : 'Broadcast channel with prospective creators'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeProject && (
              <Badge variant="outline" className="text-xs font-medium hidden sm:inline-flex">
                {getProjectStatusLabel(activeProject.status)}
              </Badge>
            )}
            <div className="flex items-center gap-1 text-2xs text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden min-[420px]:inline">Admin Mode</span>
              <span className="min-[420px]:hidden">Admin</span>
            </div>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {displayMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">No messages in this channel</p>
              <p className="text-xs max-w-sm">
                Write a message below to start coordinating deliverables and milestone feedback with {clientDisplayName}.
              </p>
            </div>
          ) : (
            displayMessages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                onPreviewAttachment={() => {}}
                onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Direct Admin Reply Composer */}
        <div className="p-3 sm:p-4 border-t border-border/80 bg-card/40 shrink-0">
          <form onSubmit={handleSendReply} className="space-y-2">
            <div className="relative rounded-xl border border-border/80 bg-background focus-within:border-amber-500/80 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all p-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Reply to ${clientDisplayName} as Studio Admin... (Press Enter to send, Shift+Enter for new line)`}
                rows={2}
                className="w-full resize-none border-0 bg-transparent text-xs p-1 focus-visible:ring-0 shadow-none text-foreground placeholder:text-muted-foreground"
              />

              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Replying as:</span>
                  <span>Senior Creative Producer</span>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={!replyText.trim() || isSending}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-2xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Reply</span>
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
