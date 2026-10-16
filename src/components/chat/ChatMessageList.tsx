'use client';

import React, { useEffect, useRef } from 'react';
import { MessageSquareDashed, ArrowDown } from 'lucide-react';

import { ChatMessage, useChatStore } from '@/lib/chatStore';
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
  /** True while the first page of messages is loading from the server. */
  isLoading?: boolean;
  projectId: string;
  unreadCount?: number;
  onClearUnread?: () => void;
  onIncrementUnread?: () => void;
  renderMessage: (message: ChatMessage) => React.ReactNode;
  contentClassName?: string;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
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
 * (auto-follow, scroll-to-end button with floating unread pill) and `Empty` state.
 */
export function ChatMessageList({
  messages,
  isLoading = false,
  projectId,
  unreadCount,
  onClearUnread,
  onIncrementUnread,
  renderMessage,
  contentClassName,
  className,
  emptyTitle,
  emptyDescription,
}: ChatMessageListProps) {
  const storeUnread = useChatStore((s) => s.unreadBelowScroll[projectId] ?? 0);
  const effectiveUnread = unreadCount ?? storeUnread;
  const clearUnread = onClearUnread ?? (() => useChatStore.getState().clearUnreadBelowScroll(projectId));
  const incrementUnread = onIncrementUnread ?? (() => useChatStore.getState().incrementUnreadBelowScroll(projectId));

  if (messages.length === 0) {
    if (isLoading) {
      return (
        <Empty className="h-full border-0" role="status" aria-busy="true">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-10 rounded-xl bg-amber-400/15 border border-amber-400/25 text-brand-text dark:text-amber-400 shadow-2xs"
            >
              <Spinner className="size-5 text-brand-text dark:text-amber-400" />
            </EmptyMedia>
            <EmptyTitle className="text-sm font-semibold">Loading conversation...</EmptyTitle>
            <EmptyDescription className="text-xs max-w-xs">
              {projectId === 'global'
                ? 'Syncing your studio support thread...'
                : 'Fetching your project messages and references...'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-10 rounded-xl bg-amber-400/15 border border-amber-400/25 text-brand-text dark:text-amber-400 shadow-2xs"
          >
            <MessageSquareDashed className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-semibold">{emptyTitle || 'No messages yet'}</EmptyTitle>
          <EmptyDescription className="text-xs max-w-sm">
            {emptyDescription ||
              (projectId === 'global'
                ? 'Message our studio team about packages, credits, or your projects.'
                : 'Drop references, ask questions, or leave feedback for the team.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className={className}>
        <MessageScrollerViewport aria-label="Project conversation">
          <MessageScrollerContent className={cn('gap-3 pb-4', contentClassName)}>
            {messages.map((msg) => (
              <MessageScrollerItem key={msg.id} messageId={msg.id}>
                {renderMessage(msg)}
              </MessageScrollerItem>
            ))}
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
