'use client';

import React, { useEffect, useRef } from 'react';
import { MessageSquareDashed, ArrowDown, Sparkles } from 'lucide-react';

import { ChatMessage, useChatStore, GLOBAL_CHAT_ID } from '@/lib/chatStore';
import { cn } from '@/lib/utils';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScrollerScrollable,
} from '@/components/ui/message-scroller';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Spinner } from '@/components/ui/spinner';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isTyping?: boolean;
  agentName: string;
  isGlobal?: boolean;
  projectId?: string;
  unreadCount?: number;
  onClearUnread?: () => void;
  onIncrementUnread?: () => void;
  renderMessage: (message: ChatMessage) => React.ReactNode;
  contentClassName?: string;
  className?: string;
}

/**
 * Inner component that hooks into the MessageScroller's internal stateStore
 * to detect when user is scrolled up and render an amber floating "↓ X new messages" pill.
 */
function ChatScrollWatcherAndPill({
  unreadCount,
  onClearUnread,
  onIncrementUnread,
  messagesLength,
}: {
  unreadCount: number;
  onClearUnread?: () => void;
  onIncrementUnread?: () => void;
  messagesLength: number;
}) {
  const scrollable = useMessageScrollerScrollable();
  const prevCountRef = useRef(messagesLength);

  // If user scrolls all the way down to bottom (scrollable.end === false), clear unread counter
  useEffect(() => {
    if (!scrollable.end && unreadCount > 0) {
      onClearUnread?.();
    }
  }, [scrollable.end, unreadCount, onClearUnread]);

  // When new messages arrive while user is scrolled up away from bottom:
  useEffect(() => {
    if (messagesLength > prevCountRef.current) {
      if (scrollable.end) {
        onIncrementUnread?.();
      }
    }
    prevCountRef.current = messagesLength;
  }, [messagesLength, scrollable.end, onIncrementUnread]);

  return (
    <MessageScrollerButton
      direction="end"
      size={unreadCount > 0 ? 'sm' : 'icon-sm'}
      variant={unreadCount > 0 ? 'default' : 'secondary'}
      className={cn(
        'left-1/2 -translate-x-1/2 shadow-lg transition-all duration-200 cursor-pointer rounded-full z-20',
        unreadCount > 0
          ? 'bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground font-black border border-amber-400/50 shadow-xs shadow-amber-400/25 px-3 py-1 h-8 w-auto'
          : 'border-border/80'
      )}
      onClick={() => {
        onClearUnread?.();
      }}
    >
      {unreadCount > 0 ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <ArrowDown className="size-3.5 animate-bounce shrink-0" />
          <span>{unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`}</span>
        </div>
      ) : (
        <>
          <ArrowDown className="size-4 shrink-0" />
          <span className="sr-only">Scroll to latest</span>
        </>
      )}
    </MessageScrollerButton>
  );
}

/**
 * Shared, reusable chat feed built on the official shadcn `MessageScroller`
 * (auto-follow, scroll-to-end button with floating unread pill), `Marker` typing status,
 * and `Empty` state.
 */
export function ChatMessageList({
  messages,
  isTyping = false,
  agentName,
  isGlobal = false,
  projectId,
  unreadCount,
  onClearUnread,
  onIncrementUnread,
  renderMessage,
  contentClassName,
  className,
}: ChatMessageListProps) {
  const firstName = agentName.split(' ')[0];

  const storeProjectId = useChatStore((s) => s.activeProjectId);
  const effectiveProjectId = isGlobal ? GLOBAL_CHAT_ID : (projectId || storeProjectId);
  const storeUnread = useChatStore((s) => s.unreadBelowScroll[effectiveProjectId] ?? 0);
  const effectiveUnread = unreadCount ?? storeUnread;
  const clearUnread = onClearUnread ?? (() => useChatStore.getState().clearUnreadBelowScroll(effectiveProjectId));
  const incrementUnread = onIncrementUnread ?? (() => useChatStore.getState().incrementUnreadBelowScroll(effectiveProjectId));

  if (messages.length === 0) {
    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-amber-400/15 text-brand-text dark:text-amber-400">
            <MessageSquareDashed />
          </EmptyMedia>
          <EmptyTitle className="text-sm">
            {isGlobal
              ? `This is your general conversation with ${firstName}.`
              : 'This is your dedicated chat for this project.'}
          </EmptyTitle>
          <EmptyDescription className="text-xs max-w-sm">
            {isGlobal
              ? 'You can ask about packages, credits, pricing, account questions, or new ideas.'
              : 'Share references, ask about milestones, or discuss revisions with Sarah.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className={className}>
        <MessageScrollerViewport aria-label="Conversation with studio producer">
          <MessageScrollerContent className={cn('gap-3 pb-4', contentClassName)}>
            {/* Subtle Studio Welcome / Context Card when conversation is starting */}
            {messages.length <= 3 && (
              <MessageScrollerItem messageId="conversation-starter-intro">
                <div className="py-2.5 px-3.5 rounded-xl bg-secondary/35 border border-border/60 text-center space-y-1 mx-auto max-w-sm my-1 animate-in fade-in duration-200">
                  <div className="inline-flex items-center gap-1.5 text-2xs font-semibold text-brand-text dark:text-amber-400">
                    <Sparkles className="size-3 text-brand-text dark:text-amber-400 shrink-0" />
                    <span>{isGlobal ? 'Studio Advisory & Support' : 'Dedicated Project Workspace'}</span>
                  </div>
                  <p className="text-2xs text-muted-foreground leading-relaxed">
                    {isGlobal
                      ? 'Ask about packages, scope recommendations, credit rollovers, or custom requests.'
                      : 'Share references, track milestones, or discuss production directly with Sarah Miller.'}
                  </p>
                </div>
              </MessageScrollerItem>
            )}

            {messages.map((msg) => (
              <MessageScrollerItem key={msg.id} messageId={msg.id}>
                {renderMessage(msg)}
              </MessageScrollerItem>
            ))}

            {isTyping && (
              <MessageScrollerItem messageId="typing-indicator">
                <Marker role="status" className="pl-10 text-xs">
                  <MarkerIcon>
                    <Spinner className="size-3.5 text-brand-text dark:text-amber-400" />
                  </MarkerIcon>
                  <MarkerContent className="shimmer font-medium">{firstName} is typing…</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <ChatScrollWatcherAndPill
          unreadCount={effectiveUnread}
          onClearUnread={clearUnread}
          onIncrementUnread={incrementUnread}
          messagesLength={messages.length}
        />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
