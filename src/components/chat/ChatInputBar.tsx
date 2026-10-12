'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Image as ImageIcon, X, Sparkles, Mic, CornerUpLeft, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';

import { ChatAttachment, useChatStore, ChatMessage, ChatReplyTo } from '@/lib/chatStore';

interface ChatInputBarProps {
  onSendMessage: (text: string, attachments?: ChatAttachment[], replyTo?: ChatReplyTo) => void;
  replyingTo?: ChatReplyTo | null;
  onCancelReply?: () => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (messageId: string, newContent: string) => void;
  isTyping?: boolean;
  compact?: boolean;
  isGlobal?: boolean;
  projectId?: string;
  activeProjectCode?: string;
  activeProjectName?: string;
  viewerRole?: 'client' | 'admin';
  placeholder?: string;
}

const QUICK_PROMPTS = [
  'What is the current project status?',
  'Can I submit revision notes?',
  'When will concept thumbnails be ready?',
];

export function ChatInputBar({
  onSendMessage,
  replyingTo = null,
  onCancelReply,
  editingMessage = null,
  onCancelEdit,
  onSaveEdit,
  compact = false,
  isGlobal = false,
  projectId,
  activeProjectCode,
  activeProjectName,
  viewerRole = 'client',
  placeholder: customPlaceholder,
}: ChatInputBarProps) {
  const effectiveId = projectId || undefined;
  const [text, setText] = useState(() =>
    editingMessage
      ? editingMessage.content
      : effectiveId
      ? useChatStore.getState().drafts[effectiveId] || ''
      : ''
  );
  const [draft, setDraft] = useState<ChatAttachment | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Composer source: the message being edited, otherwise the saved draft for this chat.
  const textSourceKey = editingMessage ? `edit:${editingMessage.id}` : `draft:${effectiveId ?? ''}`;
  const [syncedSourceKey, setSyncedSourceKey] = useState(textSourceKey);
  if (syncedSourceKey !== textSourceKey) {
    setSyncedSourceKey(textSourceKey);
    setText(
      editingMessage
        ? editingMessage.content
        : effectiveId
        ? useChatStore.getState().drafts[effectiveId] || ''
        : ''
    );
  }

  // Starting an edit or a reply focuses the composer
  const editingId = editingMessage?.id;
  const replyingToId = replyingTo?.id;
  useEffect(() => {
    if (editingId || replyingToId) {
      textareaRef.current?.focus();
    }
  }, [editingId, replyingToId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (effectiveId && !editingMessage) {
      useChatStore.getState().setDraft(effectiveId, val);
    }
  };

  const placeholder =
    customPlaceholder ||
    (editingMessage
      ? 'Update your message...'
      : replyingTo
      ? `Reply to ${replyingTo.senderName}...`
      : isGlobal
      ? viewerRole === 'admin'
        ? 'Reply to creator inquiries...'
        : 'Message the studio desk...'
      : viewerRole === 'admin'
      ? `Message ${activeProjectName || activeProjectCode || 'Client'}...`
      : compact
      ? `Message studio team${activeProjectCode ? ` (${activeProjectCode})` : ''}...`
      : `Message studio team about ${activeProjectName || activeProjectCode || 'this project'}...`);

  const canSend = (!!text.trim() || !!draft) && !isUploadingAttachment;

  const handleSend = () => {
    if (!canSend) return;

    if (editingMessage && onSaveEdit) {
      onSaveEdit(editingMessage.id, text.trim());
      setText('');
      onCancelEdit?.();
      return;
    }

    onSendMessage(text, draft ? [draft] : undefined, replyingTo || undefined);
    setText('');
    setDraft(null);
    onCancelReply?.();
    if (effectiveId) {
      useChatStore.getState().clearDraft(effectiveId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      if (editingMessage) {
        onCancelEdit?.();
        setText(effectiveId ? useChatStore.getState().drafts[effectiveId] || '' : '');
      } else if (replyingTo) {
        onCancelReply?.();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Only image files (PNG, JPG, WebP, GIF) are supported');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Images must be under 10 MB');
      return;
    }

    if (!projectId) {
      toast.error('Please select an active project first');
      return;
    }

    setIsUploadingAttachment(true);
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/projects/${projectId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      const att = data.attachment;
      setDraft({
        id: `att-${Date.now()}`,
        name: att.fileName,
        size: `${(att.fileSize / (1024 * 1024)).toFixed(1)} MB`,
        type: 'image',
        url: att.url || '',
        previewUrl: att.url || URL.createObjectURL(file),
        storagePath: att.storagePath,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
      });
      toast.success(`Attached "${file.name}"`, { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload image';
      toast.error(msg, { id: toastId });
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Quick prompts — hidden in compact mode, active edit/reply sessions, or for admin console */}
      {!compact && !editingMessage && !replyingTo && viewerRole !== 'admin' && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <span className="flex shrink-0 items-center gap-1 text-2xs font-semibold text-muted-foreground">
            <Sparkles className="size-3 text-brand-text dark:text-amber-400" /> Quick ask:
          </span>
          {QUICK_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onSendMessage(prompt)}
              className="shrink-0 rounded-full text-xs font-normal hover:border-amber-400/60 hover:bg-amber-400/10 hover:text-brand-text dark:hover:text-amber-400 cursor-pointer"
            >
              {prompt}
            </Button>
          ))}
        </div>
      )}

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-secondary/80 border border-border/80 border-l-4 border-l-amber-400 rounded-xl text-xs shadow-2xs animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-3xs uppercase tracking-wider text-brand-text dark:text-amber-400">
              <CornerUpLeft className="size-3" />
              <span>Replying to {replyingTo.senderName}</span>
            </div>
            <p className="text-2xs text-muted-foreground truncate mt-0.5 font-medium">
              {replyingTo.content}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-muted-foreground hover:text-foreground rounded-full cursor-pointer hover:bg-muted transition-colors"
            title="Cancel reply"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Edit Preview Bar */}
      {editingMessage && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-amber-400/10 border border-amber-400/30 border-l-4 border-l-amber-500 rounded-xl text-xs shadow-2xs animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-3xs uppercase tracking-wider text-brand-text dark:text-amber-400">
              <Pencil className="size-3 text-amber-500" />
              <span>Editing message</span>
            </div>
            <p className="text-2xs text-muted-foreground truncate mt-0.5 font-medium">
              {editingMessage.content}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onCancelEdit?.();
              setText(effectiveId ? useChatStore.getState().drafts[effectiveId] || '' : '');
            }}
            className="p-1 text-muted-foreground hover:text-foreground rounded-full cursor-pointer hover:bg-muted transition-colors"
            title="Cancel editing"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      {/* Composer — official shadcn InputGroup */}
      <InputGroup className="rounded-xl border-border/80 bg-secondary/20 shadow-2xs has-[[data-slot=input-group-control]:focus-visible]:border-amber-400/80 has-[[data-slot=input-group-control]:focus-visible]:ring-amber-400/20">
        {draft && (
          <InputGroupAddon align="block-start" className="pt-2.5">
            <Attachment size="sm" className="max-w-full rounded-xl border-amber-400/30 bg-amber-400/5">
              <AttachmentMedia variant="image" className="rounded-lg">
                {draft.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.previewUrl} alt={draft.name} />
                ) : (
                  <ImageIcon className="text-brand-text dark:text-amber-400" />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle className="text-foreground">{draft.name}</AttachmentTitle>
                <AttachmentDescription>{draft.size || 'Image reference'}</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label="Remove attachment" onClick={() => setDraft(null)}>
                  <X />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          </InputGroupAddon>
        )}

        <InputGroupTextarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="min-h-[40px] max-h-32 px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm leading-relaxed placeholder:text-muted-foreground/70 scrollbar-none overflow-y-auto"
        />

        <InputGroupAddon align="block-end" className="gap-2">
          {!editingMessage && (
            <>
              <InputGroupButton
                size="icon-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAttachment}
                className="size-8 rounded-lg text-muted-foreground hover:bg-amber-400/15 hover:text-brand-text dark:hover:text-amber-400 cursor-pointer disabled:opacity-50"
                aria-label="Upload image reference"
                title="Upload image reference"
              >
                {isUploadingAttachment ? (
                  <Spinner className="size-4 text-brand-text dark:text-amber-400" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </InputGroupButton>

              {viewerRole !== 'admin' && (
                <InputGroupButton
                  size="icon-sm"
                  onClick={() => {
                    toast.success('Attached creative voice memo (0:24)');
                    setText((prev) => (prev ? `${prev} 🎙️ [Voice memo: 0:24]` : '🎙️ Recorded voice note (0:24)'));
                  }}
                  className="size-8 rounded-lg text-muted-foreground hover:bg-amber-400/15 hover:text-brand-text dark:hover:text-amber-400"
                  aria-label="Record creative voice memo"
                  title="Record creative voice memo"
                >
                  <Mic className="size-4" />
                </InputGroupButton>
              )}
            </>
          )}

          {!compact && (
            <InputGroupText className="hidden sm:flex text-2xs font-mono">
              <KbdGroup>
                <Kbd>Enter</Kbd>
              </KbdGroup>
              to {editingMessage ? 'save' : 'send'} ·
              <KbdGroup>
                <Kbd>Shift</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
              new line
            </InputGroupText>
          )}

          <InputGroupButton
            variant="default"
            size="icon-sm"
            disabled={!canSend}
            onClick={handleSend}
            aria-label={editingMessage ? 'Save changes' : viewerRole === 'admin' ? 'Send reply to client' : 'Send message'}
            title={editingMessage ? 'Save changes' : viewerRole === 'admin' ? 'Send reply to client' : 'Send message'}
            className="ml-auto size-9 rounded-full bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground font-black shadow-xs shadow-amber-400/25 disabled:opacity-40 active:scale-95 flex items-center justify-center p-0 shrink-0 cursor-pointer"
          >
            {editingMessage ? <Check className="size-4 stroke-[2.5]" /> : <ArrowUp className="size-4" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
