'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { TypographyH1, TypographyMuted } from '@/components/ui/typography';
import { AuthForm } from '@/components/auth/AuthForm';
import { Spinner } from '@/components/ui/spinner';

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
      <div className="w-full max-w-sm mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[380px] space-y-3">
        <Spinner className="size-6 text-amber-500" />
        <span className="text-xs text-muted-foreground font-mono">
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] mx-auto px-2 sm:px-4 py-4 sm:py-8 animate-in fade-in duration-200">
      <Card className="rounded-2xl sm:rounded-3xl bg-card border border-border/80 shadow-xl overflow-hidden">
        <CardHeader className="text-center space-y-1.5 pb-4 pt-6 sm:pt-8 px-6 sm:px-8">
          <TypographyH1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Sign In
          </TypographyH1>
          <TypographyMuted className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Access your projects and studio credits
          </TypographyMuted>
        </CardHeader>

        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0">
          <AuthForm
            isPage={true}
            nextUrl={getSafeRedirectUrl()}
            onSuccess={() => {
              router.replace(getSafeRedirectUrl());
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-sm mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[380px] space-y-3">
          <Spinner className="size-6 text-amber-500" />
          <span className="text-xs text-muted-foreground font-mono">
            Loading sign in...
          </span>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
