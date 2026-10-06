'use client';

import Link from 'next/link';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ChatFullView } from '@/components/chat/ChatFullView';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export default function MessagesPage() {
  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={
        <Link href="/">
          <Button
            variant="default"
            size="sm"
            className="h-8 px-3 rounded-lg text-xs font-bold gap-1 shadow-xs bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Project</span>
          </Button>
        </Link>
      }
    >
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              MESSAGES
            </div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Messages
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Direct chat with our team for project updates, feedback, and questions.
            </p>
          </div>
        </div>

        {/* Embedded Full View Chat Container */}
        <div className="h-[calc(100vh-16rem)] min-h-[550px] rounded-xl border border-border/80 overflow-hidden bg-card shadow-xs">
          <ChatFullView />
        </div>
      </div>
    </StudioCardLayout>
  );
}
