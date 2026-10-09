'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthForm } from '@/components/auth/AuthForm';
import { Coins, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');

  // Verify safe relative URL to avoid open-redirect vulnerability
  const getSafeRedirectUrl = () => {
    if (
      nextParam &&
      nextParam.startsWith('/') &&
      !nextParam.startsWith('//') &&
      !nextParam.startsWith('/\\') &&
      !nextParam.includes(':')
    ) {
      return nextParam;
    }
    // If no explicit nextParam is set, check if client has an active wizard draft
    if (typeof window !== 'undefined') {
      try {
        const storedDraft = localStorage.getItem('humantek_wizard_cart');
        if (storedDraft) {
          const parsed = JSON.parse(storedDraft);
          const hasDraftPkg = parsed?.state?.selectedPackageId || parsed?.selectedPackageId;
          const isWallet = parsed?.state?.fundingSource === 'wallet' || parsed?.fundingSource === 'wallet';
          if (hasDraftPkg || isWallet) {
            return '/new-project?step=5';
          }
        }
      } catch {}
    }
    return '/projects';
  };

  const { user, isHydrated } = useUserStore();

  // If user is already authenticated in client store, redirect to target
  useEffect(() => {
    if (isHydrated && user?.email) {
      if (user.role === 'admin') {
        router.replace('/management');
      } else {
        router.replace(getSafeRedirectUrl());
      }
    }
  }, [user, isHydrated, router]);

  // Prevent flash of sign-in form for already authenticated users
  if (!isHydrated || (user && user.email)) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[380px] space-y-3">
        <div className="size-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground font-mono">
          {user?.email ? 'Opening dashboard...' : 'Loading studio session...'}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl mx-auto px-2 sm:px-4 py-2 sm:py-6 animate-in fade-in duration-200">
      <Card className="overflow-hidden rounded-2xl sm:rounded-3xl bg-card border border-border/80 shadow-xl">
        <CardContent className="grid p-0 md:grid-cols-12 min-h-[540px]">
          {/* Left Column: Form & Access Controls (7 cols on md+, full width on mobile) */}
          <div className="md:col-span-7 p-5 sm:p-8 lg:p-10 flex flex-col justify-between space-y-5">
            <div>
              {/* Creator Portal Badge */}
              <div className="flex items-center justify-between mb-3.5">
                <Badge
                  variant="outline"
                  className="text-3xs font-semibold text-brand-text border-amber-400/35 bg-amber-400/15 px-2.5 py-0.5"
                >
                  <Sparkles className="size-2.5 mr-1 text-brand-text" />
                  Creator Portal
                </Badge>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1 mb-4 sm:mb-5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Sign in to your account
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Sign in to manage your projects, studio credits, and producer messages.
                </p>
              </div>

              {/* Mobile Rate Pill (< md only) */}
              <div className="flex md:hidden items-center justify-between px-3 py-2 mb-4 rounded-xl bg-amber-400/15 border border-amber-400/25 text-xs">
                <span className="font-semibold text-brand-text flex items-center gap-1.5">
                  <Coins className="size-3.5 text-brand-text shrink-0" />
                  1 CR = $2.50 USD
                </span>
                <span className="text-muted-foreground text-3xs font-medium">
                  Credits never expire
                </span>
              </div>

              {/* The Complete Interactive AuthForm */}
              <AuthForm
                isPage={true}
                nextUrl={getSafeRedirectUrl()}
                onSuccess={() => {
                  router.replace(getSafeRedirectUrl());
                }}
              />
            </div>

            {/* Bottom Security Reassurance */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-center text-xs text-muted-foreground">
              <span className="text-3xs inline-flex items-center gap-1.5 font-medium text-muted-foreground/80">
                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Secure encrypted sign-in
              </span>
            </div>
          </div>

          {/* Right Column: Calm, Truthful Studio Operational Showcase (5 cols on md+, hidden on mobile) */}
          <div className="hidden md:flex md:col-span-5 relative bg-muted/30 dark:bg-zinc-900/40 border-l border-border/70 p-6 lg:p-8 flex-col justify-between overflow-hidden text-foreground">
            {/* Subtle ambient warm studio glow */}
            <div className="absolute -top-20 -right-20 size-60 rounded-full bg-amber-400/5 dark:bg-amber-400/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 size-60 rounded-full bg-amber-400/5 dark:bg-amber-400/5 blur-3xl pointer-events-none" />

            {/* Top Studio Credits Overview */}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 text-brand-text border border-amber-400/30 text-2xs font-semibold">
                  <Coins className="size-3 text-brand-text shrink-0" />
                  Studio Credits
                </span>
                <span className="text-2xs font-mono text-muted-foreground font-medium">39 Services</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Simple, predictable pricing.
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A fixed credit standard for art, animation, and production commissions with direct producer support.
                </p>
              </div>
            </div>

            {/* Middle: 3 Honest, Truthful Studio Pillars */}
            <div className="relative z-10 space-y-3 my-auto py-5">
              {/* Pillar 1: Fixed Rate */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-background/70 dark:bg-zinc-950/40 border border-border/60 shadow-2xs">
                <div className="size-7 rounded-lg bg-amber-400/15 text-brand-text flex items-center justify-center shrink-0 mt-0.5">
                  <Coins className="size-3.5" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between gap-2">
                    <span>1 CR = $2.50 USD</span>
                    <span className="font-mono text-3xs font-medium text-brand-text bg-amber-400/15 px-1.5 py-0.5 rounded">
                      Fixed Rate
                    </span>
                  </div>
                  <p className="text-3xs text-muted-foreground leading-normal">
                    Transparent pricing across all 39 service tiers. No surprises or unexpected fees.
                  </p>
                </div>
              </div>

              {/* Pillar 2: Milestone-Gated Approvals */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-background/70 dark:bg-zinc-950/40 border border-border/60 shadow-2xs">
                <div className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground">
                    Milestone Approvals
                  </div>
                  <p className="text-3xs text-muted-foreground leading-normal">
                    Review work in progress with your producer before approving each stage.
                  </p>
                </div>
              </div>

              {/* Pillar 3: Non-Expiring Wallet */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-background/70 dark:bg-zinc-950/40 border border-border/60 shadow-2xs">
                <div className="size-7 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="size-3.5" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground">
                    Credits Never Expire
                  </div>
                  <p className="text-3xs text-muted-foreground leading-normal">
                    Your balance stays in your wallet until you use it for current or future commissions.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom: Commercial Rights note without extra links */}
            <div className="relative z-10 pt-3 border-t border-border/60 flex items-center gap-2 text-3xs text-muted-foreground">
              <Sparkles className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
              <span>Full commercial usage rights included on all approved deliverables.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md md:max-w-4xl mx-auto px-4 py-8">
          <div className="w-full h-[580px] rounded-2xl sm:rounded-3xl bg-card border border-border animate-pulse" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
