'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');

  // Verify safe relative URL to avoid open-redirect vulnerability
  const getSafeRedirectUrl = () => {
    if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) {
      return nextParam;
    }
    return '/projects';
  };

  const { user, isHydrated, signInAsClient } = useUserStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // If user is already authenticated in client store, redirect to target
  useEffect(() => {
    if (isHydrated && user?.email) {
      router.replace(getSafeRedirectUrl());
    }
  }, [user, isHydrated, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      // 1. Forgot password flow
      if (isForgotPassword) {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send reset link');

        setMessage({
          text: data.message || 'Password reset link sent to your email.',
          type: 'success',
        });
        toast.success('Reset link dispatched. Please check your inbox.');
        return;
      }

      // 2. Real account creation flow
      if (isSignUp) {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            name: name.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Account creation failed');
        }

        const authUser = data.user;
        signInAsClient(
          authUser.name,
          authUser.email,
          authUser.walletBalance ?? 0,
          authUser.id,
          authUser.role
        );

        toast.success(`Account created! Welcome, ${authUser.name || authUser.email}`);
        router.push(getSafeRedirectUrl());
        router.refresh();
        return;
      }

      // 3. Real sign-in flow
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid email or password');
      }

      const authUser = data.user;
      signInAsClient(
        authUser.name,
        authUser.email,
        authUser.walletBalance ?? 0,
        authUser.id,
        authUser.role
      );

      toast.success(`Signed in as ${authUser.email}`);
      router.push(getSafeRedirectUrl());
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setMessage({ text: msg, type: 'error' });
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-in fade-in duration-200">
      <Card className="rounded-xl border-border bg-card shadow-xs p-6 sm:p-8">
        <CardHeader className="p-0 text-center space-y-1.5 mb-6">
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-normal text-foreground leading-snug">
            {isForgotPassword
              ? 'Reset your password'
              : isSignUp
              ? 'Create creator studio account'
              : 'Sign in to Creator Studio'}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {isForgotPassword
              ? 'Enter your email address to receive password recovery instructions.'
              : isSignUp
              ? 'Join to produce, customize, and manage your streaming & creator assets.'
              : 'Access your projects, credit balance, and studio messages.'}
          </CardDescription>
        </CardHeader>

        {message && (
          <Alert
            variant={message.type === 'success' ? 'info' : 'destructive'}
            className="mb-4 rounded-lg"
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <AlertTitle className="text-sm font-bold">
              {message.type === 'success' ? 'Success' : 'Authentication error'}
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <CardContent className="p-0">
          <form onSubmit={handleAuth} className="space-y-4">
            <FieldGroup className="space-y-4">
              {/* Optional Name field on Sign-Up */}
              {isSignUp && (
                <Field>
                  <FieldLabel
                    htmlFor="name"
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Creator / Channel Name
                  </FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    autoFocus
                    placeholder="e.g. Kira Streams"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-lg h-11 min-h-[44px] text-sm px-3.5"
                  />
                </Field>
              )}

              {/* Email Address */}
              <Field>
                <FieldLabel
                  htmlFor="email"
                  className="text-xs font-semibold text-foreground cursor-pointer"
                >
                  Email address
                </FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus={!isSignUp}
                  autoComplete="email"
                  placeholder="creator@yourdomain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg h-11 min-h-[44px] text-sm px-3.5"
                />
              </Field>

              {/* Password field (hidden in forgot-password mode) */}
              {!isForgotPassword && (
                <Field>
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel
                      htmlFor="password"
                      className="text-xs font-semibold text-foreground cursor-pointer"
                    >
                      Password
                    </FieldLabel>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setMessage(null);
                        }}
                        className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      placeholder={isSignUp ? 'Minimum 8 characters' : '••••••••'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        'rounded-lg h-11 min-h-[44px] text-sm px-3.5 pr-10',
                        !showPassword && password.length > 0 && 'tracking-widest text-base font-mono'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
              )}
            </FieldGroup>

            <Button
              type="submit"
              variant="default"
              loading={isLoading}
              loadingText={
                isForgotPassword
                  ? 'Sending reset link...'
                  : isSignUp
                  ? 'Creating account...'
                  : 'Authenticating...'
              }
              className="w-full text-sm font-semibold gap-2 mt-2 h-11 min-h-[44px] rounded-lg cursor-pointer shadow-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isForgotPassword
                ? 'Send reset link'
                : isSignUp
                ? 'Create account'
                : 'Sign in'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="p-0 mt-6 pt-4 border-t border-border flex flex-col gap-2 justify-center text-sm">
          {isForgotPassword ? (
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setMessage(null);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </button>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setMessage(null);
                    }}
                    className="font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(true);
                      setMessage(null);
                    }}
                    className="font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Create one
                  </button>
                </>
              )}
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md h-96 rounded-xl bg-card border border-border animate-pulse" />
      }
    >
      <SignInContent />
    </Suspense>
  );
}
