'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChatAttachment } from '@/lib/chatStore';

interface ChatAttachmentModalProps {
  attachment: ChatAttachment | null;
  onClose: () => void;
}

export function ChatAttachmentModal({ attachment, onClose }: ChatAttachmentModalProps) {
  if (!attachment) return null;

  return (
    <Dialog open={!!attachment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-auto max-w-[min(92vw,64rem)] p-0 gap-0 overflow-hidden bg-card border border-border/80 shadow-2xl rounded-xl">
        {/* Title/description kept for screen readers only */}
        <DialogHeader className="sr-only">
          <DialogTitle>Image Preview: {attachment.name}</DialogTitle>
          <DialogDescription>Shared attachment preview</DialogDescription>
        </DialogHeader>

        {attachment.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.previewUrl}
            alt={attachment.name}
            className="block w-full h-auto max-h-[85vh] object-contain"
          />
        ) : (
          <div className="text-center p-8 text-muted-foreground text-xs">
            Preview unavailable for this file format.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
