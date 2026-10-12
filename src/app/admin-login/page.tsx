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
import { Badge } from '@/components/ui/badge';
import { TypographyH1, TypographyMuted } from '@/components/ui/typography';
import { StudioBackground } from '@/components/StudioBackground';
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
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background text-foreground overflow-hidden select-none font-sans">
      {/* Studio Ambient Background */}
      <StudioBackground variant="default" showDots={true} />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-secondary/80 border border-amber-400/30 shadow-xs mb-2">
            <ShieldCheck className="size-8 text-amber-500" />
          </div>
          <TypographyH1 className="text-2xl font-bold tracking-tight text-foreground">
            Operations Console
          </TypographyH1>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="gold" size="sm" className="gap-1.5 font-semibold uppercase tracking-wider">
              <Lock className="size-2.5" />
              Restricted · Staff Only
            </Badge>
          </div>
          <TypographyMuted className="text-xs text-muted-foreground max-w-xs mx-auto">
            Authorized administrator authentication required. All access events are strictly logged.
          </TypographyMuted>
        </div>

        {/* Login Card */}
        <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base text-foreground font-semibold">
              Administrator Sign In
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Enter your verified studio credentials to proceed
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive" className="py-2.5 px-3 text-xs animate-in fade-in-50">
                  <ShieldAlert className="size-4 shrink-0 text-destructive" />
                  <AlertTitle className="text-xs font-semibold">Access Denied</AlertTitle>
                  <AlertDescription className="text-xs">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <FieldGroup className="space-y-3">
                <Field className="space-y-1.5">
                  <FieldLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" />
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
                    className="h-10 text-sm bg-background/50 border-border/80 text-foreground placeholder:text-muted-foreground focus-visible:border-amber-400 focus-visible:ring-amber-400/20"
                  />
                </Field>

                <Field className="space-y-1.5">
                  <FieldLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="size-3.5 text-muted-foreground" />
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
                      className="h-10 text-sm bg-background/50 border-border/80 text-foreground placeholder:text-muted-foreground focus-visible:border-amber-400 focus-visible:ring-amber-400/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                variant="gold"
                size="lg"
                loading={isLoading}
                loadingText="Authenticating Console..."
                className="w-full font-bold shadow-md shadow-amber-400/20 cursor-pointer mt-2"
              >
                <ShieldCheck className="size-4 mr-2" />
                Access Operations Console
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-2 pb-5 border-t border-border/60 flex flex-col gap-2">
            <div className="text-center w-full">
              <p className="text-2xs text-muted-foreground">
                Are you a client or creator?{' '}
                <Link
                  href="/login"
                  className="text-brand-text dark:text-amber-400 hover:underline font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  Return to Client Portal
                  <ArrowRight className="size-3" />
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>

        {/* Footer Security Watermark */}
        <p className="text-center text-3xs font-mono text-muted-foreground/60 tracking-wider">
          HUMANTEK STUDIO · SECURITY LEVEL 4 · ENCRYPTED SSL
        </p>
      </div>
    </div>
  );
}
