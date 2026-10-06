'use client';

import React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChatAttachment } from '@/lib/chatStore';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';

interface ChatAttachmentModalProps {
  attachment: ChatAttachment | null;
  onClose: () => void;
}

export function ChatAttachmentModal({ attachment, onClose }: ChatAttachmentModalProps) {
  if (!attachment) return null;

  return (
    <Dialog open={!!attachment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-4 sm:p-6 bg-card border border-border/80 shadow-2xl rounded-xl">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-sm sm:text-base font-bold text-foreground">
                {attachment.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Reference Moodboard · {attachment.size || 'Image Asset'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 pr-6">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => window.open(attachment.url, '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open Original</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="relative mt-3 rounded-xl overflow-hidden bg-black/40 border border-border/60 flex items-center justify-center min-h-[300px] max-h-[65vh]">
          {attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="max-h-[60vh] w-auto object-contain rounded-lg"
            />
          ) : (
            <div className="text-center p-8 text-muted-foreground text-xs">
              Preview unavailable for this file format.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
