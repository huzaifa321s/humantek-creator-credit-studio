import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { StudioBackground } from '@/components/StudioBackground';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Sign in — Humantek Art Creator Credits Studio',
  description: 'Sign in to access your projects, credit balance, and messages.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-between relative isolate selection:bg-amber-500/20 selection:text-amber-900">
      <StudioBackground />

      {/* Bare Minimal Header: Branded Logo + Back to Studio only */}
      <header className="w-full px-4 sm:px-6 py-4 flex items-center justify-between z-20 shrink-0">
        <Link href="/" className="flex items-center gap-2 group select-none">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-2xs tracking-wider shadow-xs group-hover:scale-105 transition-transform shrink-0">
            ART
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-foreground tracking-tight text-xs">
                Humantek Art
              </span>
              <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />
            </div>
            <span className="block text-2xs tracking-wider uppercase font-bold text-amber-600 dark:text-amber-400 leading-tight">
              Creator Credits Studio
            </span>
          </div>
        </Link>

        <Link href="/">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5 rounded-lg cursor-pointer transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to studio</span>
          </Button>
        </Link>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-20">
        {children}
      </main>

      {/* Minimal Footer */}
      <footer className="w-full px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground z-20 shrink-0">
        <p>© {new Date().getFullYear()} Humantek Art. All rights reserved.</p>
      </footer>
    </div>
  );
}
