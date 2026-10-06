'use client';

import React from 'react';
import { MessageSquareDashed } from 'lucide-react';

import { ChatMessage } from '@/lib/chatStore';
import { cn } from '@/lib/utils';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
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
  renderMessage: (message: ChatMessage) => React.ReactNode;
  contentClassName?: string;
  className?: string;
}

/**
 * Shared, reusable chat feed built on the official shadcn `MessageScroller`
 * (auto-follow, scroll-to-end button), `Marker` typing status and `Empty` state.
 * Used by both the client floating widget and the management workspace.
 */
export function ChatMessageList({
  messages,
  isTyping = false,
  agentName,
  isGlobal = false,
  renderMessage,
  contentClassName,
  className,
}: ChatMessageListProps) {
  const firstName = agentName.split(' ')[0];

  if (messages.length === 0) {
    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-amber-500/10 text-amber-600">
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
            {messages.map((msg) => (
              <MessageScrollerItem key={msg.id} messageId={msg.id}>
                {renderMessage(msg)}
              </MessageScrollerItem>
            ))}

            {isTyping && (
              <MessageScrollerItem messageId="typing-indicator">
                <Marker role="status" className="pl-10 text-xs">
                  <MarkerIcon>
                    <Spinner className="size-3.5 text-amber-500" />
                  </MarkerIcon>
                  <MarkerContent className="shimmer font-medium">{firstName} is typing…</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton className="left-1/2 shadow-md" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
