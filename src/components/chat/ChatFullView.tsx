'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useStudioChat, ChatAttachment, SAMPLE_REFERENCES } from '@/lib/chatStore';
import { useProjectsQuery } from '@/lib/queries/projects';
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
import { cn } from '@/lib/utils';
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
    messages,
    agent,
    isTyping,
    unreadCounts,
    setActiveProjectId,
    sendMessage,
    toggleReaction,
    markAllAsRead,
    registerProject,
  } = useStudioChat();

  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];

  // Register real projects dynamically into store
  useEffect(() => {
    if (projects.length > 0) {
      projects.forEach((p) => {
        registerProject({
          id: p.id,
          projectCode: p.projectCode,
          packageName: p.packageName,
          clientName: p.clientName,
          status: p.status,
          price: p.packagePrice,
          credits: p.packageCredits,
        });
      });
    }
  }, [projects, registerProject]);

  // Mark active project as read
  useEffect(() => {
    markAllAsRead();
  }, [projectId, markAllAsRead]);

  // Extract unique attachments from the currently active project chat
  const displayAttachments = useMemo(() => {
    const rawAttachments: ChatAttachment[] = messages.flatMap((m) => m.attachments || []);
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
  }, [messages]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Project-Based Creative Studio Communications</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Project Chat & Creative Lead
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Direct, isolated project discussion threads, moodboards, asset approvals, and milestone updates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/">
            <Button variant="outline" size="sm" className="h-9 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Configure Package</span>
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="secondary" size="sm" className="h-9 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer">
              <FolderKanban className="w-3.5 h-3.5 text-amber-600" />
              <span>All Projects</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main 2-Column Chat Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: PROJECT DIRECTORY & ASSETS                   */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
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
                  <Badge variant="gold" className="text-[10px] font-bold py-0 px-1.5 h-4">
                    Lead
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
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
                <div className="pt-2 border-t border-border/70 space-y-2 font-medium text-[11px] text-foreground/90">
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
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Project Moodboards ({displayAttachments.length})
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">{projectMeta.projectCode}</span>
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
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-medium backdrop-blur-xs">
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/80 leading-normal">
                Visual moodboards uploaded for {projectMeta.projectCode}. Click any frame to zoom in.
              </p>
            </Card>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: CHAT STREAM                                 */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 xl:col-span-9">
          <Card className="rounded-xl border border-border/80 bg-card shadow-sm flex flex-col gap-0 py-0 h-[740px] max-h-[85vh] overflow-hidden">
            {/* Chat Pane Header */}
            {isGlobal ? (
              <div className="px-5 py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-[56px] flex flex-col justify-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-medium text-foreground">Global Chat</span>
                    <span className="flex size-2 rounded-full bg-emerald-500 inline-block align-middle" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Replies in ~2 mins · Packages, credits & studio support
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-5 py-3 border-b border-border/70 bg-secondary/20 shrink-0 min-h-[56px] flex flex-col justify-center gap-1">
                {/* Line 1: Code · Package · Status */}
                <div className="flex items-center gap-2 flex-wrap text-sm font-medium">
                  <span className="font-mono text-foreground">
                    {projectMeta.projectCode}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-foreground/90">
                    {projectMeta.packageName}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <Badge variant="outline" className="text-[11px] font-normal text-amber-700 dark:text-amber-400 border-amber-500/40 px-1.5 py-0.5 h-auto">
                    {projectMeta.status.replace('_', ' ').toLowerCase()}
                  </Badge>
                </div>

                {/* Line 2: Client · Credits · Price (left) + Milestone Tracker ↗ (right) */}
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>Client: <b className="text-foreground font-medium">{projectMeta.clientName}</b></span>
                    <span>·</span>
                    <span><b className="text-amber-600 dark:text-amber-400 font-bold">{projectMeta.credits || 660} CR</b></span>
                    {projectMeta.price && (
                      <>
                        <span>·</span>
                        <span>${projectMeta.price.toLocaleString()} USD</span>
                      </>
                    )}
                  </div>

                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
                  >
                    <span>Milestone Tracker</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* Chat Messages Body */}
            <div className="flex-1 min-h-0 bg-card/60">
              <ChatMessageList
                messages={messages}
                isTyping={isTyping}
                agentName={agent.name}
                isGlobal={isGlobal}
                contentClassName="px-5 py-4 gap-3"
                renderMessage={(msg) => (
                  <ChatMessageItem
                    message={msg}
                    onPreviewAttachment={setPreviewAttachment}
                    onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                  />
                )}
              />
            </div>

            {/* Input Bar Footer */}
            <div className="px-4 py-3 border-t border-border/70 bg-card/90 shrink-0">
              <ChatInputBar
                onSendMessage={sendMessage}
                isTyping={isTyping}
                isGlobal={isGlobal}
                activeProjectCode={isGlobal ? undefined : projectMeta.projectCode}
                activeProjectName={isGlobal ? undefined : projectMeta.packageName}
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
