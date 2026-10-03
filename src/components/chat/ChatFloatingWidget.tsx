'use client';

import React, { useState } from 'react';
import { MessageSquare, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useStudioChat, ChatAttachment } from '@/lib/chatStore';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInputBar } from './ChatInputBar';
import { ChatAttachmentModal } from './ChatAttachmentModal';
import { ChatMessageList } from './ChatMessageList';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export function ChatFloatingWidget() {
  const { messages, agent, isOpen, isTyping, unreadCount, setIsOpen, sendMessage } = useStudioChat();
  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);

  return (
    <>
      {/* 1. Floating launcher & toggle */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2.5">
        {/* Text pill (visible when chat is closed on sm+ screens) */}
        {!isOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-card/98 border-border/90 text-foreground text-xs font-bold shadow-md shadow-black/5 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-400/80 hover:text-amber-700 dark:hover:text-amber-300 transition-all cursor-pointer backdrop-blur-md select-none h-9"
          >
            <span className="size-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25 animate-pulse shrink-0" />
            <span>Chat with Creative Producer</span>
          </Button>
        )}

        {/* Circular Action Launcher / Toggle Button */}
        <Button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close studio chat' : 'Open studio chat'}
          className={cn(
            'relative size-12 sm:size-13 rounded-full text-white transition-all duration-200 border flex items-center justify-center p-0 cursor-pointer select-none',
            isOpen
              ? 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-700 shadow-xl shadow-black/20 hover:scale-105 active:scale-95'
              : 'bg-gradient-to-br from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 border-amber-400/50 shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40 hover:scale-105 active:scale-95'
          )}
        >
          {isOpen ? (
            <X className="size-6 transition-transform duration-200 rotate-90" />
          ) : (
            <>
              <MessageSquare className="size-6 transition-transform duration-200" />
              {/* Online Green Signal Dot (visible on mobile where text pill is hidden) */}
              <span className="sm:hidden absolute bottom-0.5 right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950 shadow-xs" />
            </>
          )}

          {/* Unread Message Count Badge */}
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-background animate-bounce shadow-xs">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* 2. Expanded chat card (anchored above the bottom-right launcher) */}
      {isOpen && (
        <Card className="fixed bottom-20 right-4 sm:bottom-22 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[540px] max-h-[calc(100vh-6.5rem)] gap-0 py-0 rounded-2xl border border-border/80 bg-card/98 backdrop-blur-md shadow-2xl shadow-black/25 flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
          <CardHeader className="px-4 py-3 border-b border-border/70 bg-secondary/30 shrink-0 flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <Avatar className="size-9 border border-amber-500/50 bg-gradient-to-br from-amber-500/20 to-amber-600/30 shadow-2xs">
                  <AvatarFallback className="bg-transparent text-amber-800 dark:text-amber-300 font-bold text-xs">
                    {agent.avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate">{agent.name}</span>
                  <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px] font-medium">
                    Lead
                  </Badge>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                  <ShieldCheck className="size-3 text-emerald-500 shrink-0" />
                  {agent.responseTime}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </CardHeader>

          {/* Feed — official shadcn MessageScroller */}
          <div className="flex-1 min-h-0">
            <ChatMessageList
              messages={messages}
              isTyping={isTyping}
              agentName={agent.name}
              contentClassName="px-4 py-4 gap-4"
              renderMessage={(msg) => (
                <ChatMessageItem message={msg} compact onPreviewAttachment={setPreviewAttachment} />
              )}
            />
          </div>

          <CardFooter className="p-3 border-t border-border/70 bg-card shrink-0 block">
            <ChatInputBar onSendMessage={sendMessage} isTyping={isTyping} compact />
          </CardFooter>
        </Card>
      )}

      <ChatAttachmentModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </>
  );
}
