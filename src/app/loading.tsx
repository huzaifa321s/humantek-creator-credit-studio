import React from 'react';
import { StudioBackground } from '@/components/StudioBackground';
import { Spinner } from '@/components/ui/spinner';
import { TypographyMuted } from '@/components/ui/typography';

export default function RootLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading studio..."
      className="relative min-h-[calc(100vh-4rem)] flex-1 flex flex-col items-center justify-center p-6 antialiased"
    >
      <StudioBackground variant="subtle" showDots={true} />

      <div className="relative z-10 flex flex-col items-center text-center space-y-4 max-w-sm">
        {/* Animated Brand Emblem */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-3 rounded-2xl bg-amber-400/25 blur-lg animate-pulse" />
          <div className="relative size-14 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center font-black text-zinc-950 text-sm tracking-wider shadow-lg shadow-amber-400/30">
            ART
          </div>
        </div>

        {/* Studio Branding & Loading Text */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-foreground">
            <span>Humantek Art</span>
          </div>
          <TypographyMuted className="text-2xs uppercase tracking-widest font-bold text-brand-text dark:text-amber-400">
            Creator Credits Studio
          </TypographyMuted>
        </div>

        {/* Loading Spinner & Status */}
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Spinner className="size-4 text-amber-500" />
          <span>Loading studio...</span>
        </div>
      </div>
    </div>
  );
}
