import React from 'react';
import Link from 'next/link';
import { StudioBackground } from '@/components/StudioBackground';
import { Sparkles, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Sign in – Humantek Art',
  description: 'Sign in to access your projects, credit balance, and messages.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background relative isolate selection:bg-amber-400/25 selection:text-amber-950 font-sans">
      {/* Ambient studio spotlight without distracting dot grid */}
      <StudioBackground showDots={false} />

      {/* Minimal 56px Auth Header: Logo linking to /new-project, no full navbar clutter */}
      <header className="h-14 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Brand Logo linking to /new-project */}
        <Link
          href="/new-project"
          className="flex items-center gap-2 group select-none shrink-0"
          title="Humantek Art Creator Studio"
        >
          <div className="size-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center font-black text-zinc-950 text-2xs tracking-wider shadow-xs shadow-amber-400/30 group-hover:scale-105 transition-transform shrink-0">
            ART
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-bold text-foreground tracking-tight text-xs">
                Humantek Art
              </span>
              <Sparkles className="size-2.5 text-brand-text dark:text-amber-400 shrink-0" />
            </div>
            <span className="text-3xs uppercase tracking-wider font-semibold text-muted-foreground leading-none">
              Creator Credits Studio
            </span>
          </div>
        </Link>

        {/* Right: Small subtle link to 'Start a project' */}
        <Link
          href="/new-project"
          className="text-xs font-semibold text-muted-foreground hover:text-brand-text dark:hover:text-amber-400 transition-colors inline-flex items-center gap-1 group py-1.5 px-2.5 rounded-lg hover:bg-muted/50"
        >
          <span>Start a project</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5 text-muted-foreground/70" />
        </Link>
      </header>

      {/* Main Centered Content */}
      <main className="flex flex-1 items-center justify-center px-3 sm:px-6 py-4 sm:py-8 z-20">
        {children}
      </main>

      {/* Quiet, refined footer matching card border and muted typography */}
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground z-20 shrink-0 bg-background">
        © 2026 Humantek Art ·{' '}
        <a href="#terms" className="hover:underline hover:text-foreground transition-colors">
          Terms
        </a>{' '}
        ·{' '}
        <a href="#privacy" className="hover:underline hover:text-foreground transition-colors">
          Privacy
        </a>
      </footer>
    </div>
  );
}
