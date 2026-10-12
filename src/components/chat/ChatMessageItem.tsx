'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  CheckCheck,
  Sparkles,
  Eye,
  ThumbsUp,
  CornerUpLeft,
  Trash2,
  Play,
  Pause,
  Volume2,
  Clock,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatChatTimestamp } from '@/lib/utils';

import { ChatMessage, ChatAttachment } from '@/lib/chatStore';
import { useMessageGestures } from '@/hooks/use-message-gestures';
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  ChatDeleteMessageDialog,
  ChatMessageActionDrawer,
  ChatMessageActionToolbar,
  useMessageActions,
} from '@/components/chat/ChatMessageActions';

interface ChatMessageItemProps {
  message: ChatMessage;
  currentUserId?: string;
  /**
   * Who is viewing the thread. Determines which messages count as "own"
   * (editable / deletable, not likeable). Defaults to the creator portal.
   */
  viewerRole?: 'client' | 'admin';
  onPreviewAttachment: (attachment: ChatAttachment) => void;
  onReply?: (message: ChatMessage) => void;
  onToggleLike?: (messageId: string) => void;
  onStartEdit?: (message: ChatMessage) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (clientMessageId: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  /** Compact mode used inside the floating widget */
  compact?: boolean;
}

const LIKE_POP_MS = 650;

/** System notices rendered with the official shadcn `Marker` (separator variant). */
function SystemMarker({ content }: { content: string }) {
  return (
    <div className="flex justify-center my-4 w-full">
      <Marker variant="separator" className="text-xs text-muted-foreground py-1">
        <MarkerIcon>
          <Sparkles className="size-3.5 text-brand-text dark:text-amber-400" />
        </MarkerIcon>
        <MarkerContent className="font-medium text-xs max-w-[80%] text-center">{content}</MarkerContent>
      </Marker>
    </div>
  );
}

export const ChatMessageItem = React.memo(
  function ChatMessageItem({
    message,
    currentUserId,
    viewerRole = 'client',
    onPreviewAttachment,
    onReply,
    onToggleLike,
    onStartEdit,
    onDelete,
    onRetry,
    onScrollToMessage,
    compact = false,
  }: ChatMessageItemProps) {
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [likePopKey, setLikePopKey] = useState(0);

    const isSystem = message.sender === 'system';
    const isDeleted = Boolean(message.isDeleted);
    const isOutgoing = viewerRole === 'admin' ? message.sender === 'agent' : message.sender === 'client';
    const isOwn = isOutgoing;
    const likes = useMemo(() => (isDeleted ? [] : message.likes ?? []), [isDeleted, message.likes]);
    const hasLikes = likes.length > 0;
    const hasAttachments = !isDeleted && !!message.attachments && message.attachments.length > 0;

    const myId = currentUserId || (viewerRole === 'admin' ? 'agent-me' : 'client-me');
    const isLiked = useMemo(() => likes.some((l) => l.userId === myId), [likes, myId]);
    const likedByLabel = useMemo(
      () => likes.map((l) => (l.userId === myId ? 'You' : l.userName || 'Studio Member')).join(', '),
      [likes, myId]
    );

    const handleCopy = useCallback(async () => {
      if (!message.content) return;
      try {
        await navigator.clipboard.writeText(message.content);
        toast.success('Message copied');
      } catch {
        toast.error('Could not copy message');
      }
    }, [message.content]);

    const requestDelete = useCallback(() => setIsDeleteDialogOpen(true), []);

    const actions = useMessageActions({
      message,
      isOwn,
      isLiked,
      likeCount: likes.length,
      onToggleLike,
      onReply,
      onStartEdit,
      onRequestDelete: onDelete ? requestDelete : undefined,
      onCopy: handleCopy,
    });

    const canLike = !isOwn && !isDeleted && Boolean(onToggleLike);

    const gestures = useMessageGestures({
      enabled: !isSystem && !isDeleted && actions.length > 0,
      onDoubleTap: () => {
        if (!canLike) return;
        // Only animate when the tap results in a like, not an unlike.
        if (!isLiked) setLikePopKey(Date.now());
        onToggleLike?.(message.id);
      },
      onTap: () => setIsActionDrawerOpen(true),
      onLongPress: () => setIsActionDrawerOpen(true),
    });

    if (isSystem) {
      return <SystemMarker content={message.content} />;
    }

    return (
      <Message
        id={`msg-${message.id}`}
        align={isOutgoing ? 'end' : 'start'}
        className="group/message relative scroll-mt-20"
      >
        <MessageContent className="gap-1.5 relative">
          {/* Header: Name · Role · Timestamp · (edited) · desktop actions */}
          <MessageHeader className="gap-1.5 text-xs text-muted-foreground items-center">
            <span className="font-semibold text-foreground/90 truncate">{message.senderName}</span>
            {message.senderRole && !isOutgoing && !compact && (
              <span className="text-2xs font-mono text-brand-text/80 dark:text-amber-400/80 font-medium truncate hidden sm:inline">
                · {message.senderRole}
              </span>
            )}
            <span className="text-2xs font-mono tabular-nums whitespace-nowrap text-muted-foreground/80 ml-1 inline-flex items-center gap-1">
              <span>{formatChatTimestamp(message.timestamp)}</span>
              {isOutgoing && !isDeleted && message.status !== 'failed' && message.status !== 'sending' && (
                <CheckCheck className="size-3 text-brand-text/90 dark:text-amber-400/90 inline-block" />
              )}
            </span>
            {message.isEdited && !isDeleted && (
              <span className="text-3xs font-mono text-muted-foreground/70 italic ml-1">(edited)</span>
            )}
          </MessageHeader>

          {/* Message Bubble — double-tap to like, tap / long-press for actions (touch) */}
          <Bubble
            variant="custom"
            align={isOutgoing ? 'end' : 'start'}
            {...gestures}
            className={cn(
              'relative max-w-[85%] sm:max-w-[75%] min-w-[80px] rounded-xl transition-shadow',
              '[@media(pointer:coarse)]:select-none [@media(pointer:coarse)]:[-webkit-touch-callout:none]',
              isActionDrawerOpen && 'ring-2 ring-amber-400/70'
            )}
          >
            {/* Desktop floating hover action toolbar */}
            <ChatMessageActionToolbar
              actions={actions}
              className={cn(
                'absolute -top-3.5 right-2 z-20',
                // Touch devices use the drawer; never show ghost hover buttons there.
                '[@media(hover:none)]:hidden!'
              )}
            />

            {likePopKey > 0 && (
              <span
                key={likePopKey}
                aria-hidden="true"
                onAnimationEnd={() => setLikePopKey(0)}
                className="pointer-events-none absolute left-1/2 top-1/2 z-30 flex size-11 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/40 animate-like-pop motion-reduce:hidden"
                style={{ animationDuration: `${LIKE_POP_MS}ms` }}
              >
                <ThumbsUp className="size-5 fill-current" />
              </span>
            )}

            {isDeleted ? (
              <BubbleContent className="px-3.5 py-2 text-xs leading-relaxed rounded-xl border border-dashed border-border/80 bg-muted/30 text-muted-foreground italic flex items-center gap-1.5 shadow-2xs">
                <Trash2 className="size-3 text-muted-foreground/60 shrink-0" />
                <span>This message was deleted</span>
              </BubbleContent>
            ) : (
              <BubbleContent
                className={cn(
                  'px-3.5 py-2.5 text-sm leading-relaxed',
                  isOutgoing
                    ? message.status === 'failed'
                      ? 'rounded-xl rounded-br-sm bg-rose-500/15 border border-rose-500/30 text-foreground shadow-xs'
                      : 'rounded-xl rounded-br-sm bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 font-medium shadow-xs'
                    : 'rounded-xl rounded-bl-sm border-border/80 bg-muted/50 dark:bg-card shadow-2xs text-foreground'
                )}
              >
                {/* Quoted parent message — jumps to the original */}
                {message.replyTo && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onScrollToMessage?.(message.replyTo!.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onScrollToMessage?.(message.replyTo!.id);
                      }
                    }}
                    aria-label={`Jump to message from ${message.replyTo.senderName}`}
                    className={cn(
                      'mb-2 p-2 rounded-lg text-left border-l-3 text-2xs cursor-pointer select-none transition-colors group/quote outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                      isOutgoing
                        ? 'bg-black/15 border-zinc-900/60 text-zinc-900 hover:bg-black/20'
                        : 'bg-secondary/70 border-amber-400 text-foreground hover:bg-secondary'
                    )}
                  >
                    <div className="flex items-center gap-1 font-bold text-3xs uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      <CornerUpLeft className="size-2.5" />
                      <span className="truncate">{message.replyTo.senderName}</span>
                    </div>
                    <p className="truncate mt-0.5 font-medium text-2xs opacity-85 group-hover/quote:opacity-100">
                      {message.replyTo.content}
                    </p>
                  </div>
                )}

                {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
              </BubbleContent>
            )}

            {/* Thumbs-up count — names on hover (desktop) or in the action drawer (touch) */}
            {hasLikes && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={canLike ? () => onToggleLike?.(message.id) : undefined}
                      aria-label={`${likes.length} ${likes.length === 1 ? 'like' : 'likes'}${canLike ? (isLiked ? ', tap to unlike' : ', tap to like') : ''}`}
                      aria-pressed={canLike ? isLiked : undefined}
                      className={cn(
                        'mt-1.5 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-2xs transition-all select-none',
                        isOutgoing ? 'self-end' : 'self-start',
                        canLike ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default',
                        isLiked
                          ? 'bg-amber-400/20 border-amber-400/50 text-brand-text dark:text-amber-300'
                          : 'bg-secondary/80 hover:bg-secondary border-border/70 text-muted-foreground'
                      )}
                    />
                  }
                >
                  <ThumbsUp
                    className={cn('size-3 shrink-0', isLiked ? 'fill-current text-amber-500' : 'text-muted-foreground')}
                  />
                  <span className="text-2xs font-mono tabular-nums font-bold">{likes.length}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-2xs">
                  <span className="text-zinc-300">Liked by {likedByLabel}</span>
                </TooltipContent>
              </Tooltip>
            )}
          </Bubble>

          {/* Audio Voice Note memo pill */}
          {!isDeleted && message.audioNote && (
            <div
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/50 border border-border/70 max-w-xs text-xs min-h-[52px]',
                isOutgoing ? 'self-end' : 'self-start'
              )}
            >
              <button
                type="button"
                onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                className="size-7 rounded-full bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground flex items-center justify-center shrink-0 cursor-pointer shadow-xs shadow-amber-400/20 transition-transform active:scale-95"
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
                        isPlayingAudio ? 'bg-amber-400 animate-pulse' : 'bg-muted-foreground/40'
                      )}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-2xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono font-medium">
                    <Volume2 className="size-2.5 text-brand-text dark:text-amber-400" /> Voice Note
                  </span>
                  <span className="font-mono tabular-nums">{message.audioNote.duration}</span>
                </div>
              </div>
            </div>
          )}

          {/* Reference images */}
          {hasAttachments && (
            <AttachmentGroup className={isOutgoing ? 'justify-end self-end' : 'self-start'}>
              {message.attachments!.map((att, idx) => (
                <Attachment
                  key={`${message.id}-${att.id || 'att'}-${idx}`}
                  orientation="vertical"
                  className="w-40 has-data-[slot=attachment-content]:w-40 rounded-xl border-border/80 shadow-2xs hover:border-amber-400/50"
                >
                  <AttachmentMedia variant="image" className="rounded-lg group/media aspect-video min-h-[85px] w-full bg-secondary/40 relative overflow-hidden">
                    {att.previewUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover/attachment:opacity-100">
                          <Eye className="size-4" />
                        </span>
                      </>
                    ) : null}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle className="text-2xs font-medium">{att.name}</AttachmentTitle>
                    {att.size && (
                      <AttachmentDescription className="text-2xs font-mono tabular-nums">{att.size}</AttachmentDescription>
                    )}
                  </AttachmentContent>
                  <AttachmentTrigger aria-label={`Preview ${att.name}`} onClick={() => onPreviewAttachment(att)} />
                </Attachment>
              ))}
            </AttachmentGroup>
          )}

          {/* Message Delivery Status Indicator: only show for sending or failed error, removing repetitive 'Sent to client' clutter */}
          {isOutgoing && !isDeleted && (message.status === 'sending' || message.status === 'failed') && (
            <MessageFooter className="gap-1 text-2xs">
              {message.status === 'sending' ? (
                <span className="flex items-center gap-1 text-muted-foreground/80 animate-pulse font-mono text-3xs">
                  <Clock className="size-3 text-muted-foreground/70" />
                  <span>Sending...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                  <AlertCircle className="size-3 shrink-0" />
                  <span className="text-3xs truncate max-w-[160px] sm:max-w-xs">{message.errorReason || 'Failed to send'}</span>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(message.clientMessageId || message.id)}
                      className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 cursor-pointer active:scale-95 transition-all"
                    >
                      <RotateCw className="size-2.5" />
                      Retry
                    </button>
                  )}
                </span>
              )}
            </MessageFooter>
          )}
        </MessageContent>

        {/* Touch action drawer (Base UI portals only mount content while open) */}
        {actions.length > 0 && (
          <ChatMessageActionDrawer
            open={isActionDrawerOpen}
            onOpenChange={setIsActionDrawerOpen}
            message={message}
            actions={actions}
            likedByLabel={likedByLabel}
          />
        )}

        {onDelete && (
          <ChatDeleteMessageDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onConfirm={() => onDelete(message.id)}
          />
        )}
      </Message>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.timestamp === next.message.timestamp &&
    prev.message.status === next.message.status &&
    prev.message.errorReason === next.message.errorReason &&
    prev.message.isEdited === next.message.isEdited &&
    prev.message.isDeleted === next.message.isDeleted &&
    prev.message.attachments?.length === next.message.attachments?.length &&
    likesKey(prev.message) === likesKey(next.message) &&
    prev.message.replyTo?.id === next.message.replyTo?.id &&
    prev.currentUserId === next.currentUserId &&
    prev.viewerRole === next.viewerRole &&
    prev.compact === next.compact &&
    prev.onPreviewAttachment === next.onPreviewAttachment &&
    prev.onReply === next.onReply &&
    prev.onToggleLike === next.onToggleLike &&
    prev.onStartEdit === next.onStartEdit &&
    prev.onDelete === next.onDelete &&
    prev.onRetry === next.onRetry &&
    prev.onScrollToMessage === next.onScrollToMessage
);

/** Stable identity of who liked a message, so memo re-renders when likers change (not just the count). */
function likesKey(message: ChatMessage): string {
  return (message.likes ?? []).map((l) => l.userId).join('|');
}
