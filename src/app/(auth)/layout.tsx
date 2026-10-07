import React from 'react';
import { StudioBackground } from '@/components/StudioBackground';
import { DashboardHeader } from '@/components/header/DashboardHeader';

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
    <div className="flex min-h-dvh flex-col bg-background relative isolate selection:bg-amber-500/20 selection:text-amber-900 font-sans">
      {/* Ambient studio spotlight without distracting dot grid */}
      <StudioBackground showDots={false} />

      {/* Unified Professional Reusable Brand Header in Auth Mode */}
      <DashboardHeader mode="auth" />

      {/* Main Centered Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-10 z-20">
        {children}
      </main>

      {/* Quiet, refined footer matching card border and muted typography */}
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground z-20 shrink-0 bg-background/50">
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
