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
  EmptyTitle,
} from '@/components/ui/empty';
import { Illustration } from '@/components/ui/illustration';

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
        <div
          className="h-full w-full flex items-center justify-center"
          role="status"
          aria-busy="true"
          aria-label="Loading conversation"
        >
          <Spinner className="size-10 text-amber-500" />
        </div>
      );
    }

    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <Illustration name="empty-messages" size={96} />
          <EmptyTitle className="text-sm font-semibold">{emptyTitle || 'No messages yet'}</EmptyTitle>
          <EmptyDescription className="text-xs max-w-sm">
            {emptyDescription ||
              (projectId === 'global'
                ? 'Say hello and ask about packages, credits or your projects. Our team will reply here.'
                : 'Say hello, share references or ask a question. Our team will reply here.')}
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
