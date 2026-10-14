'use client';

import * as React from 'react';
import { Copy, CornerUpLeft, Pencil, ThumbsUp, Trash2, type LucideIcon } from 'lucide-react';

import { cn, formatChatTimestamp } from '@/lib/utils';
import type { ChatMessage } from '@/lib/chatStore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

/** Authors may edit their own messages for 60 minutes (mirrors the API rule). */
export const MESSAGE_EDIT_WINDOW_MS = 60 * 60 * 1000;

export function isWithinEditWindow(createdAtRaw?: string): boolean {
  // Optimistic / local messages have no server timestamp yet — they were just sent.
  if (!createdAtRaw) return true;
  const createdAt = new Date(createdAtRaw).getTime();
  if (Number.isNaN(createdAt)) return true;
  return Date.now() - createdAt <= MESSAGE_EDIT_WINDOW_MS;
}

/* -------------------------------------------------------------------------- */
/* Action model                                                               */
/* -------------------------------------------------------------------------- */

export type MessageActionId = 'like' | 'reply' | 'edit' | 'delete' | 'copy';

export interface MessageAction {
  id: MessageActionId;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: 'default' | 'brand' | 'destructive';
  /** Toggle state (used by Like). */
  active?: boolean;
  /** Secondary text shown in the mobile drawer. */
  hint?: string;
}

interface UseMessageActionsOptions {
  message: ChatMessage;
  isOwn: boolean;
  isLiked: boolean;
  likeCount: number;
  onToggleLike?: (messageId: string) => void;
  onReply?: (message: ChatMessage) => void;
  onStartEdit?: (message: ChatMessage) => void;
  onRequestDelete?: () => void;
  onCopy?: () => void;
}

/**
 * Builds the context-aware action list for a message.
 * Shared by the desktop hover toolbar and the mobile action drawer so both
 * surfaces always expose exactly the same permissions:
 * - Like: other people's messages only
 * - Edit: own messages within the 60-minute window
 * - Delete: own messages only
 */
export function useMessageActions({
  message,
  isOwn,
  isLiked,
  likeCount,
  onToggleLike,
  onReply,
  onStartEdit,
  onRequestDelete,
  onCopy,
}: UseMessageActionsOptions): MessageAction[] {
  const hasText = Boolean(message.content?.trim());
  const canEdit = isOwn && hasText && isWithinEditWindow(message.createdAtRaw);

  return React.useMemo(() => {
    if (message.isDeleted || message.sender === 'system') return [];

    const actions: MessageAction[] = [];

    if (!isOwn && onToggleLike) {
      actions.push({
        id: 'like',
        label: isLiked ? 'Unlike' : 'Like',
        icon: ThumbsUp,
        tone: 'brand',
        active: isLiked,
        hint: likeCount > 0 ? String(likeCount) : undefined,
        onSelect: () => onToggleLike(message.id),
      });
    }

    if (onReply) {
      const replyContent =
        message.content?.trim() ||
        (message.attachments?.length ? '📷 Photo' : 'Attachment');
      actions.push({
        id: 'reply',
        label: 'Reply',
        icon: CornerUpLeft,
        onSelect: () => onReply({ ...message, content: replyContent }),
      });
    }

    if (canEdit && onStartEdit) {
      actions.push({
        id: 'edit',
        label: 'Edit',
        icon: Pencil,
        hint: 'Within 60 min',
        onSelect: () => onStartEdit(message),
      });
    }

    if (hasText && onCopy) {
      actions.push({ id: 'copy', label: 'Copy text', icon: Copy, onSelect: onCopy });
    }

    if (isOwn && onRequestDelete) {
      actions.push({
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        tone: 'destructive',
        onSelect: onRequestDelete,
      });
    }

    return actions;
  }, [message, isOwn, isLiked, likeCount, hasText, canEdit, onToggleLike, onReply, onStartEdit, onRequestDelete, onCopy]);
}

/* -------------------------------------------------------------------------- */
/* Desktop: hover toolbar                                                     */
/* -------------------------------------------------------------------------- */

interface ChatMessageActionToolbarProps {
  actions: MessageAction[];
  className?: string;
}

/** Compact icon toolbar revealed on hover / keyboard focus (pointer devices, ≥ sm). */
export function ChatMessageActionToolbar({ actions, className }: ChatMessageActionToolbarProps) {
  if (actions.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Message actions"
      className={cn(
        'hidden sm:flex items-center gap-0.5 rounded-lg border border-border/70 bg-card p-0.5 shadow-md backdrop-blur-xs',
        'opacity-0 transition-opacity duration-150 group-hover/message:opacity-100 focus-within:opacity-100',
        className
      )}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Tooltip key={action.id}>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={action.label}
                  aria-pressed={action.id === 'like' ? action.active : undefined}
                  onClick={action.onSelect}
                  className={cn(
                    'size-6 rounded-md cursor-pointer text-muted-foreground transition-colors',
                    action.tone === 'brand' && 'hover:text-amber-500 hover:bg-amber-400/10',
                    action.tone === 'destructive' && 'hover:text-destructive hover:bg-destructive/10',
                    (!action.tone || action.tone === 'default') && 'hover:text-foreground',
                    action.active && 'text-amber-500 bg-amber-400/15'
                  )}
                />
              }
            >
              <Icon className={cn('size-3', action.active && 'fill-current')} />
            </TooltipTrigger>
            <TooltipContent side="top" className="px-2 py-1 text-2xs">
              {action.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile: bottom action drawer                                               */
/* -------------------------------------------------------------------------- */

interface ChatMessageActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ChatMessage;
  actions: MessageAction[];
  likedByLabel?: string;
}

/**
 * Swipeable bottom sheet built on the project's `Drawer` primitive.
 * The selected action runs after the close animation finishes, so focus
 * restoration never steals focus from the composer (Reply / Edit).
 */
export function ChatMessageActionDrawer({
  open,
  onOpenChange,
  message,
  actions,
  likedByLabel,
}: ChatMessageActionDrawerProps) {
  const pendingActionRef = React.useRef<MessageAction | null>(null);

  const handleSelect = (action: MessageAction) => {
    pendingActionRef.current = action;
    onOpenChange(false);
  };

  const handleOpenChangeComplete = (isOpen: boolean) => {
    if (isOpen) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.onSelect();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} onOpenChangeComplete={handleOpenChangeComplete} showSwipeHandle>
      <DrawerContent className="p-0 rounded-t-2xl border-t border-border bg-card">
        <DrawerHeader className="px-4 pt-2 pb-3 border-b border-border/70 text-left">
          <DrawerTitle className="flex items-center gap-2 text-sm font-bold">
            <span className="truncate">{message.senderName}</span>
            <span className="text-2xs font-mono font-normal tabular-nums text-muted-foreground">
              {formatChatTimestamp(message.timestamp)}
            </span>
            {message.isEdited && (
              <span className="text-3xs font-mono font-normal italic text-muted-foreground/70">(edited)</span>
            )}
          </DrawerTitle>
          <DrawerDescription className="text-xs text-muted-foreground line-clamp-2 break-words">
            {message.content || 'Attachment'}
          </DrawerDescription>
          {likedByLabel && (
            <p className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground">
              <ThumbsUp className="size-3 fill-current text-amber-500 shrink-0" />
              <span className="truncate">Liked by {likedByLabel}</span>
            </p>
          )}
        </DrawerHeader>

        <div role="menu" aria-label="Message actions" className="flex flex-col gap-0.5 p-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                role="menuitem"
                type="button"
                variant="ghost"
                onClick={() => handleSelect(action)}
                className={cn(
                  'h-12 w-full justify-start gap-3 rounded-xl px-3.5 text-sm font-semibold cursor-pointer',
                  action.tone === 'destructive'
                    ? 'text-destructive hover:text-destructive hover:bg-destructive/10 active:bg-destructive/15'
                    : 'text-foreground active:bg-secondary',
                  action.active && 'bg-amber-400/10 text-brand-text dark:text-amber-400'
                )}
              >
                <Icon
                  className={cn(
                    'size-4.5 shrink-0',
                    action.tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
                    action.id === 'edit' && 'text-amber-500',
                    action.active && 'fill-current text-amber-500'
                  )}
                />
                <span className="flex-1 text-left">{action.label}</span>
                {action.hint && (
                  <span className="text-2xs font-mono font-medium tabular-nums text-muted-foreground">
                    {action.hint}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        <DrawerFooter className="px-2 pt-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <DrawerClose
            render={
              <Button type="button" variant="outline" className="h-11 w-full rounded-xl text-sm font-semibold cursor-pointer" />
            }
          >
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */
/* Delete confirmation                                                        */
/* -------------------------------------------------------------------------- */

interface ChatDeleteMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Confirmation before a soft delete (message becomes a "This message was deleted" tombstone). */
export function ChatDeleteMessageDialog({ open, onOpenChange, onConfirm }: ChatDeleteMessageDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete message?</AlertDialogTitle>
          <AlertDialogDescription>
            Everyone in this chat will see &ldquo;This message was deleted&rdquo; instead. This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
