'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useStudioChat, ChatAttachment, SAMPLE_REFERENCES } from '@/lib/chatStore';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInputBar } from './ChatInputBar';
import { ChatAttachmentModal } from './ChatAttachmentModal';
import { ChatMessageList } from './ChatMessageList';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  ShieldCheck,
  Coins,
  FolderKanban,
  ImageIcon,
  Clock,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  FileText,
  Eye,
  MessageSquare,
} from 'lucide-react';

export function ChatFullView() {
  const { messages, agent, isTyping, sendMessage, markAllAsRead } = useStudioChat();
  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  // Mark messages as read when opening full view
  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // Extract all attachments from chat history for the assets gallery
  const allAttachments: ChatAttachment[] = messages.flatMap((m) => m.attachments || []);
  const displayAttachments = allAttachments.length > 0 ? allAttachments : SAMPLE_REFERENCES;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Direct Studio Communications</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Client Messages & Creative Producer
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Collaborate directly with your assigned creative lead on scopes, moodboards, asset approvals, and order tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/">
            <Button variant="outline" size="sm" className="h-9 text-xs font-semibold gap-1.5 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Configure Package</span>
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="secondary" size="sm" className="h-9 text-xs font-semibold gap-1.5 rounded-xl">
              <FolderKanban className="w-3.5 h-3.5 text-amber-600" />
              <span>My Projects</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main 2-Column Chat Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: PRODUCER & ASSETS SIDEBAR (lg:col-span-4)    */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-4">
          {/* Producer Profile Card */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="relative">
                <Avatar className="w-12 h-12 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-amber-600/30 text-amber-800 dark:text-amber-300 font-extrabold text-sm shadow-md">
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
                  <CheckCircle2 className="w-3 h-3" /> Online & Active
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 space-y-2 text-xs">
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
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Security
                </span>
                <span className="font-medium text-foreground">Encrypted Channel</span>
              </div>
            </div>
          </Card>

          {/* Active Package & Wallet Widget */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Wallet & Credits
                </span>
              </div>
              <Badge variant="outline" className="text-xs font-bold text-amber-600 border-amber-500/30">
                80 CR Available
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Active Package:</span>
                <b className="text-foreground">Creator Forge</b>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Current Queue Status:</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">In Production</span>
              </div>
              <div className="pt-2">
                <Link href="/projects">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8 rounded-lg cursor-pointer">
                    Track Deliverables & Timelines →
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          {/* Reference Moodboards & Files Gallery */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Shared Moodboards ({displayAttachments.length})
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">Art Board</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {displayAttachments.map((att) => (
                <div
                  key={att.id}
                  onClick={() => setPreviewAttachment(att)}
                  className="group relative rounded-xl overflow-hidden border border-border/70 bg-black/20 cursor-pointer aspect-video hover:border-amber-500/60 transition-all"
                >
                  {att.previewUrl && (
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
              Click any asset to expand full-resolution reference frames.
            </p>
          </Card>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: FULL-HEIGHT CHAT STREAM (lg:col-span-8)     */}
        {/* ========================================================= */}
        <div className="lg:col-span-8">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-sm flex flex-col gap-0 py-0 h-[700px] max-h-[82vh] overflow-hidden">
            {/* Chat Pane Header */}
            <CardHeader className="p-4 sm:p-5 border-b border-border/70 bg-secondary/20 shrink-0 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                    Creative Producer Discussion
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Live channel with {agent.name} · Ask questions, send moodboards, or request custom quotes
                  </CardDescription>
                </div>
              </div>

              <Badge variant="outline" className="hidden sm:inline-flex text-xs font-medium">
                1 Thread · Client-Wide
              </Badge>
            </CardHeader>

            {/* Chat Messages Body */}
            <div className="flex-1 min-h-0 bg-card/60">
              <ChatMessageList
                messages={messages}
                isTyping={isTyping}
                agentName={agent.name}
                contentClassName="px-4 sm:px-6 py-5 gap-5"
                renderMessage={(msg) => (
                  <ChatMessageItem message={msg} onPreviewAttachment={setPreviewAttachment} />
                )}
              />
            </div>

            {/* Input Bar Footer */}
            <div className="p-4 border-t border-border/70 bg-card/90 shrink-0">
              <ChatInputBar
                onSendMessage={sendMessage}
                isTyping={isTyping}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Lightbox Preview Modal */}
      <ChatAttachmentModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
}
