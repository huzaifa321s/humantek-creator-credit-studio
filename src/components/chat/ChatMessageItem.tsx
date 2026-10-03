'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCheck, Sparkles, FolderKanban, Eye } from 'lucide-react';

import { ChatMessage, ChatAttachment } from '@/lib/chatStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';

interface ChatMessageItemProps {
  message: ChatMessage;
  onPreviewAttachment: (attachment: ChatAttachment) => void;
  /** Compact mode used inside the floating widget */
  compact?: boolean;
}

/** System notices rendered with the official shadcn `Marker` (separator variant). */
function SystemMarker({ content }: { content: string }) {
  return (
    <Marker variant="separator" className="text-[11px] py-1">
      <MarkerIcon>
        <Sparkles className="size-3.5 text-amber-500" />
      </MarkerIcon>
      <MarkerContent className="font-medium max-w-[80%]">{content}</MarkerContent>
    </Marker>
  );
}

export function ChatMessageItem({ message, onPreviewAttachment, compact = false }: ChatMessageItemProps) {
  if (message.sender === 'system') {
    return <SystemMarker content={message.content} />;
  }

  const isClient = message.sender === 'client';
  const hasAttachments = !!message.attachments && message.attachments.length > 0;

  return (
    <Message align={isClient ? 'end' : 'start'}>
      {!isClient && (
        <MessageAvatar>
          <Avatar className="size-8 border border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-amber-600/30 shadow-2xs">
            <AvatarFallback className="bg-transparent text-amber-800 dark:text-amber-300 font-bold text-[11px]">
              SM
            </AvatarFallback>
          </Avatar>
        </MessageAvatar>
      )}

      <MessageContent className="gap-1.5">
        <MessageHeader className="gap-1.5 text-[11px]">
          <span className="font-semibold text-foreground/85 truncate">{message.senderName}</span>
          {message.senderRole && !isClient && !compact && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate hidden sm:inline">
              · {message.senderRole}
            </span>
          )}
          <span className="text-[10px] font-normal whitespace-nowrap text-muted-foreground/80 ml-1">
            {message.timestamp.replace('Today at ', '')}
          </span>
        </MessageHeader>

        {message.content && (
          <Bubble
            variant={isClient ? 'default' : 'outline'}
            align={isClient ? 'end' : 'start'}
            className={compact ? 'max-w-[88%]' : 'max-w-[85%] sm:max-w-[75%]'}
          >
            <BubbleContent
              className={
                isClient
                  ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs text-[13px]'
                  : 'rounded-2xl rounded-bl-md border-border/80 bg-card shadow-2xs text-[13px]'
              }
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </BubbleContent>
          </Bubble>
        )}

        {/* Reference images — official shadcn Attachment (vertical, image media) */}
        {hasAttachments && (
          <AttachmentGroup className={isClient ? 'justify-end self-end' : 'self-start'}>
            {message.attachments!.map((att) => (
              <Attachment
                key={att.id}
                orientation="vertical"
                className="w-40 has-data-[slot=attachment-content]:w-40 rounded-2xl border-border/80 shadow-2xs hover:border-amber-500/50"
              >
                <AttachmentMedia variant="image" className="rounded-xl group/media">
                  {att.previewUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={att.previewUrl} alt={att.name} />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover/attachment:opacity-100">
                        <Eye className="size-4" />
                      </span>
                    </>
                  ) : null}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle className="text-[11px]">{att.name}</AttachmentTitle>
                  {att.size && <AttachmentDescription className="text-[10px]">{att.size}</AttachmentDescription>}
                </AttachmentContent>
                <AttachmentTrigger aria-label={`Preview ${att.name}`} onClick={() => onPreviewAttachment(att)} />
              </Attachment>
            ))}
          </AttachmentGroup>
        )}

        {/* Order confirmation card — rendered inside an outline Bubble */}
        {message.orderCard && (
          <Bubble variant="outline" align={isClient ? 'end' : 'start'} className="w-full max-w-72">
            <BubbleContent className="w-full rounded-2xl border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <FolderKanban className="size-3.5 text-amber-600" />
                  <span>{message.orderCard.projectCode}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold text-amber-600 border-amber-500/40">
                  {message.orderCard.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                <span className="font-medium text-foreground truncate">{message.orderCard.packageName}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">
                  {message.orderCard.credits} Credits
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">${message.orderCard.price} USD</span>
                <Link href="/projects" className="text-[11px] font-semibold text-amber-600 hover:underline">
                  View in Projects →
                </Link>
              </div>
            </BubbleContent>
          </Bubble>
        )}

        {isClient && (
          <MessageFooter className="gap-1 text-[10px] text-amber-600/90 dark:text-amber-400/90">
            <CheckCheck className="size-3" />
            <span>Delivered to studio</span>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}
