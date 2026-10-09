'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, isHydrated, isAdmin, signInAsClient } = useUserStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in as admin, redirect to management immediately
  useEffect(() => {
    if (isHydrated && user?.email && isAdmin()) {
      router.replace('/management');
    }
  }, [user, isHydrated, isAdmin, router]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage('Please enter both administrative email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          adminOnly: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Authentication failed. Please check credentials.');
        setIsLoading(false);
        return;
      }

      // Update local client store with authenticated admin session
      signInAsClient(
        data.user?.name || 'Administrator',
        data.user?.email || cleanEmail,
        data.user?.walletBalance || 0,
        data.user?.id || '',
        'admin'
      );

      toast.success('Administrator authenticated', {
        description: 'Welcome back. Opening Studio Operations Console...',
      });

      router.replace(data.redirect || '/management');
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during admin authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/10 via-zinc-950 to-zinc-950 pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900 border border-amber-400/30 shadow-inner mb-2">
            <ShieldCheck className="size-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Operations Console
          </h1>
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider bg-amber-400/15 text-amber-400 border border-amber-400/30">
              <Lock className="size-2.5" />
              Restricted · Staff Only
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Authorized administrator authentication required. All access events are strictly logged.
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-zinc-900/90 border-zinc-800 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base text-zinc-200 font-semibold">
              Administrator Sign In
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Enter your verified studio credentials to proceed
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive" className="bg-rose-950/40 border-rose-800/50 text-rose-200">
                  <ShieldAlert className="size-4 text-rose-400" />
                  <AlertTitle className="text-xs font-semibold">Access Denied</AlertTitle>
                  <AlertDescription className="text-xs text-rose-300">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <FieldGroup className="space-y-3">
                <Field className="space-y-1.5">
                  <FieldLabel className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Mail className="size-3.5 text-zinc-400" />
                    Admin Email
                  </FieldLabel>
                  <Input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@humantek.art"
                    disabled={isLoading}
                    className="bg-zinc-950/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:ring-amber-400/20 text-sm h-10"
                  />
                </Field>

                <Field className="space-y-1.5">
                  <FieldLabel className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Lock className="size-3.5 text-zinc-400" />
                    Master Password
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={isLoading}
                      className="bg-zinc-950/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:ring-amber-400/20 text-sm h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground font-black h-10 shadow-lg shadow-amber-400/25 border-none transition-all cursor-pointer mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="size-3.5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                    Authenticating Console...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 text-xs">
                    <ShieldCheck className="size-4" />
                    Access Operations Console
                  </span>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-2 pb-5 border-t border-zinc-800/60 flex flex-col gap-2">
            <div className="text-center w-full">
              <p className="text-2xs text-zinc-500">
                Are you a client or creator?{' '}
                <Link
                  href="/login"
                  className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  Return to Client Portal
                  <ArrowRight className="size-3" />
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>

        {/* Footer Security Watermark */}
        <p className="text-center text-3xs font-mono text-zinc-600 tracking-wider">
          HUMANTEK STUDIO · SECURITY LEVEL 4 · ENCRYPTED SSL
        </p>
      </div>
    </div>
  );
}
