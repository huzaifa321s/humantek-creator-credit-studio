'use client';

import React, { useState, useRef } from 'react';
import { ArrowUp, Paperclip, Image as ImageIcon, X, Sparkles, Mic } from 'lucide-react';
import { toast } from 'sonner';

import { ChatAttachment, SAMPLE_REFERENCES } from '@/lib/chatStore';
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

interface ChatInputBarProps {
  onSendMessage: (text: string, attachments?: ChatAttachment[]) => void;
  isTyping?: boolean;
  compact?: boolean;
  isGlobal?: boolean;
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
  isTyping = false,
  compact = false,
  isGlobal = false,
  activeProjectCode,
  activeProjectName,
}: ChatInputBarProps) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<ChatAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const quickPrompts = isGlobal ? GLOBAL_QUICK_PROMPTS : PROJECT_QUICK_PROMPTS;
  const placeholder = compact
    ? isGlobal
      ? 'Message Sarah about packages & credits...'
      : 'Message Sarah or share references...'
    : isGlobal
    ? 'Message Sarah about packages, credits, or anything else...'
    : 'Message Sarah, share references or ask a question...';

  const canSend = (!!text.trim() || !!draft) && !isTyping;

  const handleSend = () => {
    if (!canSend) return;
    onSendMessage(text, draft ? [draft] : undefined);
    setText('');
    setDraft(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
      {/* Quick prompts — shadcn Button (outline, xs) */}
      {!compact && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <span className="flex shrink-0 items-center gap-1 text-2xs font-semibold text-muted-foreground">
            <Sparkles className="size-3 text-amber-500" /> Quick ask:
          </span>
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onSendMessage(prompt)}
              className="shrink-0 rounded-full text-xs font-normal hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400"
            >
              {prompt}
            </Button>
          ))}
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      {/* Composer — official shadcn InputGroup */}
      <InputGroup className="rounded-xl border-border/80 bg-secondary/20 shadow-2xs has-[[data-slot=input-group-control]:focus-visible]:border-amber-500/60 has-[[data-slot=input-group-control]:focus-visible]:ring-amber-500/20">
        {draft && (
          <InputGroupAddon align="block-start" className="pt-2.5">
            <Attachment size="sm" className="max-w-full rounded-xl border-amber-500/30 bg-amber-500/5">
              <AttachmentMedia variant="image" className="rounded-lg">
                {draft.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.previewUrl} alt={draft.name} />
                ) : (
                  <ImageIcon className="text-amber-600" />
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="min-h-[40px] max-h-32 px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm leading-relaxed placeholder:text-muted-foreground/70 scrollbar-none overflow-y-auto"
        />

        <InputGroupAddon align="block-end" className="gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <InputGroupButton
                  size="icon-sm"
                  className="size-8 rounded-lg text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
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
                <ImageIcon className="size-4 text-amber-600" />
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
                  <Sparkles className="size-3.5 shrink-0 text-amber-500" />
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
            className="size-8 rounded-lg text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
            aria-label="Record creative voice memo"
            title="Record creative voice memo"
          >
            <Mic className="size-4" />
          </InputGroupButton>

          {!compact && (
            <InputGroupText className="hidden sm:flex text-2xs font-mono">
              <KbdGroup>
                <Kbd>Enter</Kbd>
              </KbdGroup>
              to send ·
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
            aria-label="Send message"
            className="ml-auto size-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 active:scale-95 flex items-center justify-center p-0 shrink-0"
          >
            <ArrowUp className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
