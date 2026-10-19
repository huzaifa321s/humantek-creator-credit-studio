'use client';

import React from 'react';
import './globals.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TypographyH1,
  TypographyMuted,
} from '@/components/ui/typography';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased font-sans selection:bg-amber-400/25 selection:text-amber-950">
        <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden">
          {/* Subtle Ambient Radial Lighting */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
          >
            <div
              className="absolute -top-[100px] left-1/2 -translate-x-1/2 w-[900px] max-w-full h-[450px] rounded-full blur-3xl opacity-30"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 30%, rgba(245, 158, 11, 0.25) 0%, transparent 70%)',
              }}
            />
          </div>

          {/* Minimal Fallback Top Header */}
          <header className="relative z-10 w-full border-b border-border/60 bg-background/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo.webp"
                alt="Humantek Art — Creator Credits Studio"
                width={72}
                height={28}
                className="h-8 w-auto shrink-0"
              />
            </div>
          </header>

          {/* Main Error View */}
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-md mx-auto flex flex-col items-center text-center space-y-6">
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-2 rounded-2xl bg-amber-400/15 blur-md" />
                <div className="relative size-16 rounded-2xl bg-card border border-border/80 flex items-center justify-center text-amber-500 shadow-sm">
                  <AlertCircle className="size-8" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-center">
                  <Badge variant="destructive" size="default">
                    System Error
                  </Badge>
                </div>

                <TypographyH1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Application Error
                </TypographyH1>

                <TypographyMuted className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  A critical error occurred while rendering the studio layout. Reloading the page will restore the session.
                </TypographyMuted>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="gold"
                  size="default"
                  onClick={() => reset()}
                  className="font-bold shadow-xs cursor-pointer min-w-28"
                >
                  <RotateCcw className="size-4 mr-2" />
                  Reload
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.href = '/';
                    }
                  }}
                  className="cursor-pointer border-border/80 hover:bg-muted min-w-28"
                >
                  <Home className="size-4 mr-2" />
                  Home
                </Button>
              </div>
            </div>
          </main>

          {/* Minimal Footer */}
          <footer className="relative z-10 w-full border-t border-border/50 bg-background/50 px-4 py-3 text-center">
            <TypographyMuted className="text-2xs text-muted-foreground">
              Humantek Art &copy; {new Date().getFullYear()} Creator Credits Studio
            </TypographyMuted>
          </footer>
        </div>
      </body>
    </html>
  );
}
