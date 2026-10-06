'use client';

import React, { useState } from 'react';
import {
  CheckCheck,
  Sparkles,
  Eye,
  Copy,
  Check,
  Smile,
  Play,
  Pause,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { ChatMessage, ChatAttachment } from '@/lib/chatStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from '@/components/ui/message';
import { Bubble, BubbleContent, BubbleReactions } from '@/components/ui/bubble';
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
  onToggleReaction?: (emoji: string) => void;
  /** Compact mode used inside the floating widget */
  compact?: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '🚀', '🔥'];

/** System notices rendered with the official shadcn `Marker` (separator variant). */
function SystemMarker({ content }: { content: string }) {
  return (
    <div className="flex justify-center my-4 w-full">
      <Marker variant="separator" className="text-xs text-muted-foreground py-1">
        <MarkerIcon>
          <Sparkles className="size-3.5 text-amber-500" />
        </MarkerIcon>
        <MarkerContent className="font-medium text-xs max-w-[80%] text-center">{content}</MarkerContent>
      </Marker>
    </div>
  );
}

export function ChatMessageItem({
  message,
  onPreviewAttachment,
  onToggleReaction,
  compact = false,
}: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  if (message.sender === 'system') {
    return <SystemMarker content={message.content} />;
  }

  const isClient = message.sender === 'client';
  const hasAttachments = !!message.attachments && message.attachments.length > 0;
  const hasReactions = !!message.reactions && message.reactions.length > 0;

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Message copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Message align={isClient ? 'end' : 'start'} className="group/message">
      {!isClient && (
        <MessageAvatar>
          <Avatar className="size-7 border border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-amber-600/30 shadow-2xs">
            <AvatarFallback className="bg-transparent text-amber-800 dark:text-amber-300 font-bold text-xs">
              SM
            </AvatarFallback>
          </Avatar>
        </MessageAvatar>
      )}

      <MessageContent className="gap-1.5 relative">
        {/* Header: Name · Role · Timestamp */}
        <MessageHeader className="gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/90 truncate">{message.senderName}</span>
          {message.senderRole && !isClient && !compact && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate hidden sm:inline">
              · {message.senderRole}
            </span>
          )}
          <span className="text-xs font-normal whitespace-nowrap text-muted-foreground/80 ml-1">
            {message.timestamp.replace('Today at ', '')}
          </span>

          {/* Micro action toolbar on hover */}
          <div
            className={cn(
              'opacity-0 group-hover/message:opacity-100 transition-opacity ml-auto flex items-center gap-0.5',
              isClient && 'order-first mr-auto ml-0'
            )}
          >
            {message.content && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleCopy}
                title="Copy message"
                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer rounded-md"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              </Button>
            )}

            {onToggleReaction && (
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Add reaction"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer rounded-md"
                >
                  <Smile className="size-3" />
                </Button>

                {showEmojiPicker && (
                  <div
                    className={cn(
                      'absolute z-30 -top-8 flex items-center gap-1 bg-popover border border-border p-1 rounded-full shadow-lg animate-in zoom-in-95 duration-100',
                      isClient ? 'right-0' : 'left-0'
                    )}
                  >
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onToggleReaction(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="size-6 flex items-center justify-center hover:scale-125 transition-transform text-xs cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </MessageHeader>

        {/* Message Bubble */}
        {message.content && (
          <Bubble
            variant={isClient ? 'default' : 'outline'}
            align={isClient ? 'end' : 'start'}
            className={cn('relative max-w-[75%]')}
          >
            <BubbleContent
              className={cn(
                'px-3.5 py-2.5 text-sm leading-relaxed',
                isClient
                  ? 'rounded-xl rounded-br-sm bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs'
                  : 'rounded-xl rounded-bl-sm border-border/80 bg-muted/50 dark:bg-card shadow-2xs text-foreground'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </BubbleContent>

            {/* ReUI Bubble Reactions */}
            {hasReactions && (
              <BubbleReactions
                side="bottom"
                align={isClient ? 'end' : 'start'}
                className="gap-1 mt-1 z-10"
              >
                {message.reactions!.map((r) => (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={() => onToggleReaction?.(r.emoji)}
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
                      r.reacted
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-300'
                        : 'bg-background hover:bg-muted border-border/70 text-muted-foreground'
                    )}
                    title={`Reacted ${r.count} times`}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-[10px] font-mono">{r.count}</span>
                  </button>
                ))}
              </BubbleReactions>
            )}
          </Bubble>
        )}

        {/* Audio Voice Note memo pill */}
        {message.audioNote && (
          <div
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/50 border border-border/70 max-w-xs text-xs',
              isClient ? 'self-end' : 'self-start'
            )}
          >
            <button
              type="button"
              onClick={() => setIsPlayingAudio(!isPlayingAudio)}
              className="size-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-2xs transition-transform active:scale-95"
              aria-label={isPlayingAudio ? 'Pause audio note' : 'Play audio note'}
            >
              {isPlayingAudio ? (
                <Pause className="size-3.5 fill-current" />
              ) : (
                <Play className="size-3.5 fill-current ml-0.5" />
              )}
            </button>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-0.5 h-3">
                {[40, 70, 30, 90, 60, 100, 45, 80, 50, 75, 35, 65, 85, 40].map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-1 rounded-full transition-all duration-300',
                      isPlayingAudio ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground/40'
                    )}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1 font-mono font-medium">
                  <Volume2 className="size-2.5 text-amber-600" /> Creative Brief Note
                </span>
                <span className="font-mono">{message.audioNote.duration}</span>
              </div>
            </div>
          </div>
        )}

        {/* Reference images — official shadcn Attachment (vertical, image media) */}
        {hasAttachments && (
          <AttachmentGroup className={isClient ? 'justify-end self-end' : 'self-start'}>
            {message.attachments!.map((att, idx) => (
              <Attachment
                key={`${message.id}-${att.id || 'att'}-${idx}`}
                orientation="vertical"
                className="w-40 has-data-[slot=attachment-content]:w-40 rounded-xl border-border/80 shadow-2xs hover:border-amber-500/50"
              >
                <AttachmentMedia variant="image" className="rounded-lg group/media">
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
                  {att.size && (
                    <AttachmentDescription className="text-[10px]">{att.size}</AttachmentDescription>
                  )}
                </AttachmentContent>
                <AttachmentTrigger aria-label={`Preview ${att.name}`} onClick={() => onPreviewAttachment(att)} />
              </Attachment>
            ))}
          </AttachmentGroup>
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
