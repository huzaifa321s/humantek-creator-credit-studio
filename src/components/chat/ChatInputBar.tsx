'use client';

import React, { useState, useRef } from 'react';
import { ArrowUp, Paperclip, Image as ImageIcon, X, Sparkles } from 'lucide-react';
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
}

const QUICK_PROMPTS = [
  'How do credit roll-overs work?',
  'Can I request custom 3D modeling?',
  'What is the standard delivery turnaround?',
];

export function ChatInputBar({ onSendMessage, isTyping = false, compact = false }: ChatInputBarProps) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<ChatAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="size-3 text-amber-500" /> Quick ask:
          </span>
          {QUICK_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onSendMessage(prompt)}
              className="shrink-0 rounded-full text-[11px] font-normal hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400"
            >
              {prompt}
            </Button>
          ))}
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      {/* Composer — official shadcn InputGroup */}
      <InputGroup className="rounded-2xl border-border/80 bg-secondary/20 shadow-2xs has-[[data-slot=input-group-control]:focus-visible]:border-amber-500/60 has-[[data-slot=input-group-control]:focus-visible]:ring-amber-500/20">
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
          placeholder="Message Sarah, share references or ask a question…"
          rows={1}
          className="min-h-11 max-h-32 px-3.5 pt-3 text-[13px] leading-relaxed placeholder:text-muted-foreground/70"
        />

        <InputGroupAddon align="block-end" className="gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <InputGroupButton
                  size="icon-sm"
                  className="rounded-xl text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
                  aria-label="Attach reference"
                >
                  <Paperclip />
                </InputGroupButton>
              }
            />
            <DropdownMenuContent align="start" side="top" className="w-64 p-1.5 text-xs">
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Add reference assets
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer gap-2 py-2">
                <ImageIcon className="size-4 text-amber-600" />
                <div>
                  <span className="block font-semibold">Upload image</span>
                  <span className="text-[10px] text-muted-foreground">PNG or JPG from your computer</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-0.5 text-[10px] text-muted-foreground">
                Sample moodboards
              </DropdownMenuLabel>
              {SAMPLE_REFERENCES.map((sample) => (
                <DropdownMenuItem
                  key={sample.id}
                  onClick={() => setDraft(sample)}
                  className="cursor-pointer gap-2 py-1.5 text-[11px]"
                >
                  <Sparkles className="size-3.5 shrink-0 text-amber-500" />
                  <span className="truncate">{sample.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {!compact && (
            <InputGroupText className="hidden sm:flex text-[10px]">
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
            className="ml-auto rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 active:scale-95"
          >
            <ArrowUp />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
