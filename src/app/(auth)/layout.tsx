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
    <div className="min-h-screen w-full bg-background flex flex-col justify-between relative isolate selection:bg-amber-500/20 selection:text-amber-900 font-sans">
      <StudioBackground />

      {/* Unified Professional Reusable Brand Header in Auth Mode */}
      <DashboardHeader mode="auth" />

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-20">
        {children}
      </main>

      {/* Minimal Studio Footer */}
      <footer className="w-full px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground z-20 shrink-0 border-t border-border/40 bg-background/50 backdrop-blur-xs">
        <p>© {new Date().getFullYear()} Humantek Art. All rights reserved.</p>
      </footer>
    </div>
  );
}
