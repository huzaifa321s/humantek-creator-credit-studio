'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Image as ImageIcon, X, Sparkles, Mic, CornerUpLeft, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

import { ChatAttachment, SAMPLE_REFERENCES, useChatStore, ChatMessage, ChatReplyTo } from '@/lib/chatStore';

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
}

const GLOBAL_QUICK_PROMPTS = [
  'How do credit roll-overs work?',
  'What packages do you offer?',
  'What is the standard delivery turnaround?',
];

const PROJECT_QUICK_PROMPTS = [
  'What is the next milestone?',
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
  isTyping = false,
  compact = false,
  isGlobal = false,
  projectId,
  activeProjectCode,
  activeProjectName,
}: ChatInputBarProps) {
  const effectiveId = projectId || (isGlobal ? 'global' : undefined);
  const [text, setText] = useState(() =>
    effectiveId ? useChatStore.getState().drafts[effectiveId] || '' : ''
  );
  const [draft, setDraft] = useState<ChatAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore draft when switching active project or drawer reopening
  useEffect(() => {
    if (!effectiveId) return;
    if (editingMessage) return; // Do not overwrite active edit session with draft
    const saved = useChatStore.getState().drafts[effectiveId] || '';
    setText(saved);
  }, [effectiveId, editingMessage]);

  // When editingMessage changes, populate input and focus
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (effectiveId && !editingMessage) {
      useChatStore.getState().setDraft(effectiveId, val);
    }
  };

  const quickPrompts = isGlobal ? GLOBAL_QUICK_PROMPTS : PROJECT_QUICK_PROMPTS;
  const placeholder = editingMessage
    ? 'Update your message...'
    : replyingTo
    ? `Reply to ${replyingTo.senderName}...`
    : compact
    ? isGlobal
      ? 'Message Sarah about packages & credits...'
      : 'Message Sarah or share references...'
    : isGlobal
    ? 'Message Sarah about packages, credits, or anything else...'
    : 'Message Sarah, share references or ask a question...';

  const canSend = (!!text.trim() || !!draft) && !isTyping;

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDraft({
      id: `att-${Date.now()}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type: 'image',
      previewUrl: URL.createObjectURL(file),
      url: '#',
    });
    toast.success(`Attached "${file.name}"`);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      {/* Quick prompts — hidden in compact mode or active edit/reply sessions */}
      {!compact && !editingMessage && !replyingTo && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <span className="flex shrink-0 items-center gap-1 text-2xs font-semibold text-muted-foreground">
            <Sparkles className="size-3 text-brand-text dark:text-amber-400" /> Quick ask:
          </span>
          {quickPrompts.map((prompt) => (
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

      {/* WhatsApp / Studio style Reply Preview Bar */}
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

      {/* WhatsApp / Studio style Edit Preview Bar */}
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <InputGroupButton
                      size="icon-sm"
                      className="size-8 rounded-lg text-muted-foreground hover:bg-amber-400/15 hover:text-brand-text dark:hover:text-amber-400"
                      aria-label="Attach reference"
                    >
                      <Paperclip className="size-4" />
                    </InputGroupButton>
                  }
                />
                <DropdownMenuContent align="start" side="top" className="w-64 p-1.5 text-xs">
                  <DropdownMenuLabel className="px-2 py-1 text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                    Add reference assets
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer gap-2 py-2">
                    <ImageIcon className="size-4 text-brand-text dark:text-amber-400" />
                    <div>
                      <span className="block font-semibold">Upload image</span>
                      <span className="text-2xs text-muted-foreground">PNG or JPG from your computer</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                    Sample moodboards
                  </DropdownMenuLabel>
                  {SAMPLE_REFERENCES.map((sample) => (
                    <DropdownMenuItem
                      key={sample.id}
                      onClick={() =>
                        setDraft({
                          ...sample,
                          id: `sample-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        })
                      }
                      className="cursor-pointer gap-2 py-1.5 text-2xs"
                    >
                      <Sparkles className="size-3.5 shrink-0 text-brand-text dark:text-amber-400" />
                      <span className="truncate">{sample.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <InputGroupButton
                size="icon-sm"
                onClick={() => {
                  toast.success('Attached creative voice memo (0:24)');
                  setText((prev) => (prev ? `${prev} 🎙️ [Voice memo: 0:24]` : '🎙️ Recorded brief audio note (0:24)'));
                }}
                className="size-8 rounded-lg text-muted-foreground hover:bg-amber-400/15 hover:text-brand-text dark:hover:text-amber-400"
                aria-label="Record creative voice memo"
                title="Record creative voice memo"
              >
                <Mic className="size-4" />
              </InputGroupButton>
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
            aria-label={editingMessage ? 'Save changes' : 'Send message'}
            title={editingMessage ? 'Save changes' : 'Send message'}
            className="ml-auto size-9 rounded-full bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground font-black shadow-xs shadow-amber-400/25 disabled:opacity-40 active:scale-95 flex items-center justify-center p-0 shrink-0 cursor-pointer"
          >
            {editingMessage ? <Check className="size-4 stroke-[2.5]" /> : <ArrowUp className="size-4" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
