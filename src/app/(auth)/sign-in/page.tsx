'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { useUserStore } from '@/lib/userStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field';
import { toast } from 'sonner';
import { Lock, Mail, Loader2, CheckCircle2, AlertTriangle, Sparkles, Eye, EyeOff } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  const router = useRouter();
  const { user, signInAsClient } = useUserStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const isConfigured = isRealSupabaseConfigured();

  // If user is already authenticated, redirect immediately to My Projects
  useEffect(() => {
    if (user && user.email && user.id !== 'client-guest') {
      router.replace('/projects');
    }
  }, [user, router]);

  // Gate demo helpers behind environment flag so they never ship to production
  const showDemoHelpers = process.env.NODE_ENV !== 'production' && !isConfigured;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (!isConfigured) {
        // Fallback demo authentication when Supabase is not configured
        signInAsClient(email ? email.split('@')[0] : 'Kira Streams', email || 'creator@humantek.art');
        toast.success(`Signed in as ${email || 'creator@humantek.art'}`);
        router.push('/projects');
        router.refresh();
        return;
      }

      const supabase = createClient();
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({
          text: 'Account created! Please check your email for the confirmation link.',
          type: 'success',
        });
        toast.success('Account created! Verification link sent.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Signed in successfully!');
        router.push('/projects');
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setMessage({ text: msg, type: 'error' });
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    setEmail('creator@humantek.art');
    setPassword('DemoPass2026!');
    toast.info('Loaded demo creator credentials. Click Sign in.');
  };

  const handleForgotPassword = () => {
    toast.info('Password reset instructions will be sent to your registered email.');
  };

  return (
    <div className="w-full max-w-md space-y-4 animate-in fade-in duration-200">
      <Card className="rounded-xl border-border bg-card shadow-xs p-6 sm:p-8">
        <CardHeader className="p-0 text-center space-y-2 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-sm flex items-center justify-center mx-auto shadow-xs">
            ART
          </div>
          {/* Loosened tracking so words don't look squeezed */}
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-normal text-foreground leading-snug">
            {isSignUp ? 'Create studio account' : 'Sign in to Creator Studio'}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Access your projects, credit balance, and messages.
          </CardDescription>
        </CardHeader>

        {/* Demo banner — hidden in production */}
        {showDemoHelpers && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Demo mode active. You can enter any email or use the button below to sign in.</span>
          </div>
        )}

        {message && (
          <Alert variant={message.type === 'success' ? 'info' : 'destructive'} className="mb-4 rounded-lg">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <AlertTitle className="text-sm font-bold">
              {message.type === 'success' ? 'Verification sent' : 'Authentication error'}
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">{message.text}</AlertDescription>
          </Alert>
        )}

        <CardContent className="p-0">
          <form onSubmit={handleAuth} className="space-y-4">
            <FieldGroup className="space-y-3.5">
              <Field>
                <FieldLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email address
                </FieldLabel>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="creator@humantek.art"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg h-9 text-sm"
                />
              </Field>

              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                  </FieldLabel>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-lg h-9 text-sm pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>
            </FieldGroup>

            {/* Clear sentence case action button */}
            <Button
              type="submit"
              variant="default"
              disabled={isLoading}
              className="w-full text-sm font-semibold gap-2 mt-2 h-9 rounded-lg cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                </>
              ) : isSignUp ? (
                'Create account'
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Demo elements — gated behind environment flag, hidden in production */}
          {showDemoHelpers && (
            <>
              <div className="my-5 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                  Or
                </span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDemoSignIn}
                className="w-full text-sm gap-2 font-medium rounded-lg h-9 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                Fill demo creator credentials
              </Button>
            </>
          )}
        </CardContent>

        <CardFooter className="p-0 mt-6 pt-4 border-t border-border flex justify-center text-sm">
          {/* Subtle muted prompt with only the action link highlighted */}
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
        </CardFooter>
      </Card>
    </div>
  );
}
