'use client';

import React, { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { AuthForm } from '@/components/auth/AuthForm';

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

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      <Card className="p-6 rounded-2xl bg-card border border-border shadow-xl">
        <CardHeader className="p-0 pb-4 text-center">
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Sign In to Humantek Studio
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Access your creator dashboard, projects, and studio wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-2">
          <AuthForm
            isPage={true}
            nextUrl={getSafeRedirectUrl()}
            onSuccess={() => {
              router.replace(getSafeRedirectUrl());
            }}
          />
        </CardContent>
      </Card>

      <div className="text-center mt-4">
        <Link
          href="/admin-login"
          className="text-xs text-muted-foreground/70 hover:text-amber-500 transition-colors inline-flex items-center gap-1.5"
        >
          <span>Staff or Studio Operations?</span>
          <span className="font-semibold underline underline-offset-2">Admin Console</span>
        </Link>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto px-4 py-8">
          <div className="w-full h-96 rounded-2xl bg-card border border-border animate-pulse" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
