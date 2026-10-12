'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCheck,
  Sparkles,
  Eye,
  Copy,
  Check,
  ThumbsUp,
  CornerUpLeft,
  Pencil,
  Trash2,
  Play,
  Pause,
  Volume2,
  Clock,
  AlertCircle,
  RotateCw,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatChatTimestamp } from '@/lib/utils';

import { ChatMessage, ChatAttachment } from '@/lib/chatStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
  currentUserId?: string;
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
    onPreviewAttachment,
    onReply,
    onToggleLike,
    onStartEdit,
    onDelete,
    onRetry,
    onScrollToMessage,
    compact = false,
  }: ChatMessageItemProps) {
    const [copied, setCopied] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
    const [showLikePop, setShowLikePop] = useState(false);

    const lastTapRef = React.useRef<number>(0);
    const singleTapTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const triggerLikePop = () => {
      setShowLikePop(true);
      setTimeout(() => setShowLikePop(false), 700);
    };

    const handleBubbleClick = (e: React.MouseEvent) => {
      if (isDeleted) return;

      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      // Double-tap threshold (< 300ms)
      if (timeSinceLastTap < 300) {
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        lastTapRef.current = 0;

        // Instant Like toggle (other person's messages)
        if (!isOwnMessage && onToggleLike) {
          triggerLikePop();
          onToggleLike(message.id);
        }
      } else {
        lastTapRef.current = now;
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
        }

        // On touch / small mobile screens, open action sheet on single tap after debounce
        singleTapTimerRef.current = setTimeout(() => {
          const isTouch =
            typeof window !== 'undefined' &&
            (window.innerWidth < 640 || window.matchMedia('(pointer: coarse)').matches);

          if (isTouch) {
            setIsActionSheetOpen(true);
          }
          singleTapTimerRef.current = null;
        }, 280);
      }
    };

    const handleTouchStart = () => {
      if (isDeleted) return;
      longPressTimerRef.current = setTimeout(() => {
        setIsActionSheetOpen(true);
      }, 500);
    };

    const handleTouchEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    if (message.sender === 'system') {
      return <SystemMarker content={message.content} />;
    }

    const isClient = message.sender === 'client';
    const isDeleted = Boolean(message.isDeleted);
    const hasAttachments = !isDeleted && !!message.attachments && message.attachments.length > 0;
    const hasLikes = !isDeleted && !!message.likes && message.likes.length > 0;

    const myId = currentUserId || (isClient ? 'client-me' : 'agent-me');
    const isOwnMessage = isClient; // In client portal, client sender is user's own message

    const isLiked = useMemo(() => {
      if (!message.likes || message.likes.length === 0) return false;
      return message.likes.some((l) => l.userId === myId);
    }, [message.likes, myId]);

    const likedByLabel = useMemo(() => {
      if (!message.likes || message.likes.length === 0) return '';
      return message.likes
        .map((l) => (l.userId === myId ? 'You' : l.userName || 'Studio Member'))
        .join(', ');
    }, [message.likes, myId]);

    // Author can edit own message within 60 minutes
    const canEdit = useMemo(() => {
      if (!isOwnMessage || isDeleted) return false;
      if (!message.createdAtRaw && !message.timestamp) return true;
      try {
        const timeMs = message.createdAtRaw ? new Date(message.createdAtRaw).getTime() : Date.now();
        return Date.now() - timeMs <= 60 * 60 * 1000;
      } catch {
        return true;
      }
    }, [isOwnMessage, isDeleted, message.createdAtRaw, message.timestamp]);

    const handleCopy = async () => {
      if (!message.content || isDeleted) return;
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
      <Message
        id={`msg-${message.id}`}
        align={isClient ? 'end' : 'start'}
        className="group/message relative scroll-mt-20"
      >
        {!isClient && (
          <MessageAvatar>
            <Avatar className="size-7 border border-amber-400/40 bg-amber-400/15 shadow-2xs">
              <AvatarFallback className="bg-transparent text-brand-text dark:text-amber-300 font-bold text-xs">
                SM
              </AvatarFallback>
            </Avatar>
          </MessageAvatar>
        )}

        <MessageContent className="gap-1.5 relative">
          {/* Header: Name · Role · Timestamp · (edited) */}
          <MessageHeader className="gap-1.5 text-xs text-muted-foreground items-center">
            <span className="font-semibold text-foreground/90 truncate">{message.senderName}</span>
            {message.senderRole && !isClient && !compact && (
              <span className="text-2xs font-mono text-brand-text/80 dark:text-amber-400/80 font-medium truncate hidden sm:inline">
                · {message.senderRole}
              </span>
            )}
            <span className="text-2xs font-mono tabular-nums whitespace-nowrap text-muted-foreground/80 ml-1">
              {formatChatTimestamp(message.timestamp)}
            </span>
            {message.isEdited && !isDeleted && (
              <span className="text-3xs font-mono text-muted-foreground/70 italic ml-1">
                (edited)
              </span>
            )}

            {/* Mobile More Button (•••) */}
            {!isDeleted && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsActionSheetOpen(true);
                }}
                title="Message actions"
                className={cn(
                  'sm:hidden h-6 w-6 text-muted-foreground/70 hover:text-foreground cursor-pointer rounded-md transition-colors',
                  isClient ? 'order-first mr-auto ml-0' : 'ml-auto'
                )}
              >
                <MoreHorizontal className="size-3.5" />
                <span className="sr-only">Message actions</span>
              </Button>
            )}

            {/* Desktop Action Toolbar on hover */}
            {!isDeleted && (
              <div
                className={cn(
                  'hidden sm:flex opacity-0 group-hover/message:opacity-100 transition-opacity ml-auto items-center gap-0.5 bg-background/80 dark:bg-card/90 backdrop-blur-xs border border-border/70 rounded-lg px-1 py-0.5 shadow-2xs select-none',
                  isClient && 'order-first mr-auto ml-0'
                )}
              >
                {/* Thumb like button (available on other person's messages) */}
                {!isOwnMessage && onToggleLike && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onToggleLike(message.id)}
                    title={isLiked ? 'Unlike' : 'Like (thumbs up)'}
                    className={cn(
                      'h-6 w-6 rounded-md cursor-pointer transition-colors',
                      isLiked
                        ? 'text-amber-500 bg-amber-400/15 hover:bg-amber-400/25'
                        : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-400/10'
                    )}
                  >
                    <ThumbsUp className={cn('size-3', isLiked && 'fill-current text-amber-500')} />
                  </Button>
                )}

                {/* Reply button (available on all messages) */}
                {onReply && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onReply(message)}
                    title="Reply"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer rounded-md transition-colors"
                  >
                    <CornerUpLeft className="size-3" />
                  </Button>
                )}

                {/* Edit button (author only, within 60 mins) */}
                {canEdit && onStartEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onStartEdit(message)}
                    title="Edit message"
                    className="h-6 w-6 text-muted-foreground hover:text-amber-500 cursor-pointer rounded-md transition-colors"
                  >
                    <Pencil className="size-3" />
                  </Button>
                )}

                {/* Delete button (author only) */}
                {isOwnMessage && onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Delete message"
                    className="h-6 w-6 text-muted-foreground hover:text-rose-500 cursor-pointer rounded-md transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}

                {/* Copy button */}
                {message.content && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleCopy}
                    title="Copy text"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer rounded-md transition-colors"
                  >
                    {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  </Button>
                )}
              </div>
            )}
          </MessageHeader>

          {/* Message Bubble */}
          <Bubble
            variant={isClient ? 'default' : 'outline'}
            align={isClient ? 'end' : 'start'}
            onClick={handleBubbleClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={cn(
              'relative max-w-[85%] sm:max-w-[75%] transition-all cursor-pointer sm:cursor-default select-none sm:select-text',
              isActionSheetOpen && 'ring-2 ring-amber-400/80 rounded-xl'
            )}
          >
            {/* Double-tap Like Pop Animation */}
            {showLikePop && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 overflow-visible">
                <div className="size-12 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-lg shadow-amber-400/50 animate-like-pop">
                  <ThumbsUp className="size-6 fill-current text-zinc-950 stroke-[2.5]" />
                </div>
              </div>
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
                  isClient
                    ? message.status === 'failed'
                      ? 'rounded-xl rounded-br-sm bg-rose-500/15 border border-rose-500/30 text-foreground shadow-xs'
                      : 'rounded-xl rounded-br-sm bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 font-medium shadow-xs'
                    : 'rounded-xl rounded-bl-sm border-border/80 bg-muted/50 dark:bg-card shadow-2xs text-foreground'
                )}
              >
                {/* Replied parent message preview quote */}
                {message.replyTo && (
                  <div
                    onClick={() => onScrollToMessage?.(message.replyTo!.id)}
                    className={cn(
                      'mb-2 p-2 rounded-lg text-left border-l-3 text-2xs cursor-pointer select-none transition-colors group/quote',
                      isClient
                        ? 'bg-black/15 border-zinc-900/60 text-zinc-900 hover:bg-black/20'
                        : 'bg-secondary/70 border-amber-400 text-foreground hover:bg-secondary'
                    )}
                    title="Click to jump to replied message"
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

                {message.content && (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </BubbleContent>
            )}

            {/* Like Badge Pill with anchored tooltip */}
            {hasLikes && (
              <div
                className={cn(
                  'relative group/likes mt-1.5 px-0.5 inline-flex',
                  isClient ? 'justify-end self-end' : 'justify-start self-start'
                )}
              >
                <button
                  type="button"
                  onClick={isOwnMessage ? undefined : () => onToggleLike?.(message.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border transition-all shadow-2xs select-none',
                    isOwnMessage ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95',
                    isLiked
                      ? 'bg-amber-400/20 border-amber-400/50 text-brand-text dark:text-amber-300'
                      : 'bg-secondary/80 hover:bg-secondary border-border/70 text-muted-foreground'
                  )}
                  title={isOwnMessage ? 'Liked by studio members' : isLiked ? 'Unlike' : 'Like'}
                >
                  <ThumbsUp className={cn('size-3 shrink-0', isLiked ? 'fill-current text-amber-500' : 'text-muted-foreground')} />
                  <span className="text-2xs font-mono tabular-nums font-bold">{message.likes!.length}</span>
                </button>

                {/* Anchored Tooltip */}
                <div
                  className={cn(
                    'absolute bottom-full mb-1.5 hidden group-hover/likes:flex flex-col gap-0.5 bg-zinc-950/95 border border-zinc-800 p-2 rounded-xl text-white shadow-xl z-50 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 select-none w-max max-w-[200px]',
                    isClient ? 'right-0' : 'left-0'
                  )}
                >
                  <div className="flex items-center gap-1 text-3xs font-bold uppercase tracking-wider text-amber-400">
                    <ThumbsUp className="size-2.5 fill-current text-amber-400 shrink-0" />
                    <span>Liked by</span>
                  </div>
                  <p className="text-2xs text-zinc-300 leading-snug break-words">
                    {likedByLabel}
                  </p>
                </div>
              </div>
            )}
          </Bubble>

          {/* Audio Voice Note memo pill */}
          {!isDeleted && message.audioNote && (
            <div
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/50 border border-border/70 max-w-xs text-xs min-h-[52px]',
                isClient ? 'self-end' : 'self-start'
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
                    <Volume2 className="size-2.5 text-brand-text dark:text-amber-400" /> Creative Brief Note
                  </span>
                  <span className="font-mono tabular-nums">{message.audioNote.duration}</span>
                </div>
              </div>
            </div>
          )}

          {/* Reference images */}
          {hasAttachments && (
            <AttachmentGroup className={isClient ? 'justify-end self-end' : 'self-start'}>
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

          {/* Message Delivery Status Indicator */}
          {isClient && !isDeleted && (
            <MessageFooter className="gap-1 text-2xs">
              {message.status === 'sending' ? (
                <span className="flex items-center gap-1 text-muted-foreground/80 animate-pulse font-mono text-3xs">
                  <Clock className="size-3 text-muted-foreground/70" />
                  <span>Sending...</span>
                </span>
              ) : message.status === 'failed' ? (
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
              ) : (
                <span className="flex items-center gap-1 text-brand-text/90 dark:text-amber-400/90">
                  <CheckCheck className="size-3 text-brand-text dark:text-amber-400" />
                  <span className="text-muted-foreground">Delivered to studio</span>
                </span>
              )}
            </MessageFooter>
          )}
        </MessageContent>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-popover border border-border p-4 rounded-xl shadow-2xl max-w-xs w-full space-y-3 animate-in zoom-in-95 duration-150">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Delete message?</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This will remove the message content from the workspace for all studio members.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs cursor-pointer rounded-lg"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs font-semibold cursor-pointer rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onDelete?.(message.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Action Sheet */}
        <Sheet open={isActionSheetOpen} onOpenChange={setIsActionSheetOpen}>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl border-t border-border/80 bg-card p-4 pb-8 max-w-lg mx-auto sm:max-w-md shadow-2xl space-y-3 z-50"
          >
            <SheetHeader className="p-0 text-left border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-foreground truncate">{message.senderName}</span>
                  <span className="text-3xs font-mono text-muted-foreground">{formatChatTimestamp(message.timestamp)}</span>
                  {message.isEdited && <span className="text-3xs text-muted-foreground/70 italic">(edited)</span>}
                </div>
              </div>
              <SheetTitle className="sr-only">Message Actions</SheetTitle>
              <SheetDescription className="text-2xs text-muted-foreground line-clamp-2 mt-1">
                &ldquo;{message.content}&rdquo;
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-1 gap-1.5 pt-1">
              {/* 1. Like / Unlike */}
              {!isOwnMessage && onToggleLike && (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    onToggleLike(message.id);
                  }}
                  className={cn(
                    'flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer',
                    isLiked
                      ? 'bg-amber-400/15 text-brand-text dark:text-amber-400 border border-amber-400/30'
                      : 'hover:bg-secondary/70 active:bg-secondary text-foreground'
                  )}
                >
                  <ThumbsUp className={cn('size-4 shrink-0', isLiked ? 'fill-current text-amber-500' : 'text-muted-foreground')} />
                  <div className="flex-1 flex items-center justify-between">
                    <span>{isLiked ? 'Unlike message' : 'Like message'}</span>
                    {hasLikes && (
                      <span className="text-3xs text-muted-foreground font-mono tabular-nums">({message.likes!.length})</span>
                    )}
                  </div>
                </button>
              )}

              {/* 2. Reply */}
              {onReply && (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    onReply(message);
                  }}
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-xs font-semibold hover:bg-secondary/70 active:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                >
                  <CornerUpLeft className="size-4 text-muted-foreground shrink-0" />
                  <span>Reply</span>
                </button>
              )}

              {/* 3. Edit (only own messages < 60 min) */}
              {canEdit && onStartEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    onStartEdit(message);
                  }}
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-xs font-semibold hover:bg-secondary/70 active:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                >
                  <Pencil className="size-4 text-amber-500 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span>Edit message</span>
                    <span className="text-3xs text-muted-foreground font-mono">(within 60m)</span>
                  </div>
                </button>
              )}

              {/* 4. Delete (only own messages) */}
              {isOwnMessage && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-xs font-semibold hover:bg-rose-500/10 active:bg-rose-500/20 text-rose-500 transition-colors text-left cursor-pointer"
                >
                  <Trash2 className="size-4 text-rose-500 shrink-0" />
                  <span>Delete message</span>
                </button>
              )}

              {/* 5. Copy Text */}
              {message.content && (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleCopy();
                  }}
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-xs font-semibold hover:bg-secondary/70 active:bg-secondary text-foreground transition-colors text-left cursor-pointer"
                >
                  <Copy className="size-4 text-muted-foreground shrink-0" />
                  <span>Copy text</span>
                </button>
              )}
            </div>

            {/* Cancel button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsActionSheetOpen(false)}
              className="w-full h-10 text-xs font-semibold rounded-xl mt-2 cursor-pointer"
            >
              Cancel
            </Button>
          </SheetContent>
        </Sheet>
      </Message>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.status === next.message.status &&
    prev.message.errorReason === next.message.errorReason &&
    prev.message.isEdited === next.message.isEdited &&
    prev.message.isDeleted === next.message.isDeleted &&
    prev.message.likes?.length === next.message.likes?.length &&
    prev.message.replyTo?.id === next.message.replyTo?.id &&
    prev.currentUserId === next.currentUserId &&
    prev.compact === next.compact &&
    prev.onPreviewAttachment === next.onPreviewAttachment &&
    prev.onReply === next.onReply &&
    prev.onToggleLike === next.onToggleLike &&
    prev.onStartEdit === next.onStartEdit &&
    prev.onDelete === next.onDelete &&
    prev.onRetry === next.onRetry &&
    prev.onScrollToMessage === next.onScrollToMessage
);
