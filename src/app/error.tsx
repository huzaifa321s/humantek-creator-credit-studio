'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudioBackground } from '@/components/StudioBackground';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TypographyH1,
  TypographyMuted,
} from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { AlertCircle, RotateCcw, ArrowLeft, Home, Sparkles } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log unexpected runtime errors to console
    console.error('Studio application error:', error);
  }, [error]);

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background text-foreground antialiased selection:bg-amber-400/25 selection:text-amber-950 overflow-x-hidden">
      {/* 1. Ambient Studio Lighting Background */}
      <StudioBackground variant="subtle" showDots={true} />

      {/* 2. Minimal Studio Header */}
      <header className="relative z-10 w-full border-b border-border/60 bg-background/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 group transition-transform hover:opacity-95"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center font-black text-zinc-950 text-xs tracking-wider shadow-xs shadow-amber-400/30 group-hover:scale-105 transition-transform shrink-0">
            ART
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-foreground tracking-tight text-sm">
                Humantek Art
              </span>
              <Sparkles className="size-3 text-amber-500 shrink-0" />
            </div>
            <span className="block text-3xs tracking-wider uppercase font-bold text-brand-text dark:text-amber-400 leading-tight">
              Creator Credits Studio
            </span>
          </div>
        </Link>
      </header>

      {/* 3. Main Centered Error State */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto flex flex-col items-center text-center space-y-6">
          {/* Minimal Illuminated Error Icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-2 rounded-2xl bg-amber-400/15 blur-md" />
            <div className="relative size-16 rounded-2xl bg-card border border-border/80 flex items-center justify-center text-amber-500 shadow-sm">
              <AlertCircle className="size-8" />
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-2">
            <div className="flex items-center justify-center">
              <Badge variant="warning-light" size="default">
                Application Error
              </Badge>
            </div>

            <TypographyH1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Something Went Wrong
            </TypographyH1>

            <TypographyMuted className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              An unexpected error occurred while loading this view. You can try refreshing or go back to continue.
            </TypographyMuted>
          </div>

          {/* Clean App Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="gold"
              size="default"
              onClick={() => reset()}
              className="font-bold shadow-xs cursor-pointer min-w-28"
            >
              <RotateCcw className="size-4 mr-2" />
              Try Again
            </Button>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
              className="cursor-pointer border-border/80 hover:bg-muted min-w-28"
            >
              <ArrowLeft className="size-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </main>

      {/* 4. Minimal Footer */}
      <footer className="relative z-10 w-full border-t border-border/50 bg-background/50 px-4 py-3 text-center">
        <TypographyMuted className="text-2xs text-muted-foreground">
          Humantek Art &copy; {new Date().getFullYear()} Creator Credits Studio
        </TypographyMuted>
      </footer>
    </div>
  );
}
