'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { TypographyH1, TypographyMuted } from '@/components/ui/typography';
import { AuthForm } from '@/components/auth/AuthForm';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';

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

  const isResetFlow = searchParams.get('reset') === 'true';
  const isForgotFlow = searchParams.get('forgot') === 'true';
  const { user, isHydrated } = useUserStore();

  // If user is already authenticated in client store (and not completing a password reset), redirect to target
  useEffect(() => {
    if (isHydrated && user?.email && !isResetFlow) {
      if (user.role === 'admin') {
        router.replace('/management');
      } else {
        router.replace(getSafeRedirectUrl());
      }
    }
  }, [user, isHydrated, isResetFlow, router]);

  // Prevent flash of sign-in form for already authenticated users
  if (!isHydrated || (user && user.email && !isResetFlow)) {
    return <StudioPageLoader label="Redirecting to workspace..." variant="auth" />;
  }

  return (
    <div className="w-full max-w-[420px] mx-auto px-2 sm:px-4 py-4 sm:py-8 animate-in fade-in duration-200">
      <Card className="rounded-2xl sm:rounded-3xl bg-card border border-border/80 shadow-xl overflow-hidden">
        <CardHeader className="text-center space-y-1.5 pb-4 pt-6 sm:pt-8 px-6 sm:px-8">
          <TypographyH1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {isResetFlow ? 'Reset Password' : 'Sign In'}
          </TypographyH1>
          <TypographyMuted className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {isResetFlow
              ? 'Choose a new password for your Studio account'
              : 'Access your projects and studio credits'}
          </TypographyMuted>
        </CardHeader>

        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0">
          <AuthForm
            isPage={true}
            initialMode={isResetFlow ? 'reset-link' : isForgotFlow ? 'forgot' : 'signin'}
            nextUrl={getSafeRedirectUrl()}
            onSuccess={() => {
              window.location.href = getSafeRedirectUrl();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<StudioPageLoader label="Loading sign in..." variant="auth" />}>
      <SignInContent />
    </Suspense>
  );
}
