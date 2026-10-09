'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useUserStore, StudioUser } from '@/lib/userStore';
import { toast } from 'sonner';

export type AuthFormMode = 'signin' | 'signup' | 'otp';

export interface AuthFormProps {
  initialMode?: 'signin' | 'signup';
  defaultEmail?: string;
  onSuccess?: (user: StudioUser) => void;
  onClose?: () => void;
  isPage?: boolean;
  nextUrl?: string;
}

export function AuthForm({
  initialMode = 'signin',
  defaultEmail = '',
  onSuccess,
  onClose,
  isPage = false,
  nextUrl = '/projects',
}: AuthFormProps) {
  const router = useRouter();
  const { signInAsClient } = useUserStore();

  const [mode, setMode] = useState<AuthFormMode>(initialMode);
  const [sharedEmail, setSharedEmail] = useState(defaultEmail);

  // Sign In fields
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up fields
  const [signUpName, setSignUpName] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // OTP fields
  const [otpCode, setOtpCode] = useState('');
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Refs for accessible focus management
  const emailInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Reset errors when switching modes, but KEEP shared email
  const switchMode = (newMode: AuthFormMode) => {
    setMode(newMode);
    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(false);
  };

  // Focus appropriate input on mount or mode change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === 'signup') {
        nameInputRef.current?.focus();
      } else if (mode === 'signin') {
        emailInputRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [mode]);

  // 1. Handle Sign In
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sharedEmail.trim().toLowerCase(),
          password: signInPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid email or password. Please try again.');
      }

      if (data.user) {
        signInAsClient(
          data.user.name,
          data.user.email,
          data.user.walletBalance,
          data.user.id,
          data.user.role
        );

        if (data.user.role === 'admin' || data.user.isAdmin) {
          toast.success('Welcome back, Administrator. Redirecting to management console...');
          onClose?.();
          router.replace('/management');
          return;
        }

        toast.success(`Welcome back, ${data.user.name || 'Creator'}!`);
        if (isPage) {
          router.refresh();
        }
        onSuccess?.(data.user);
        onClose?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Sign Up
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpName.trim(),
          email: sharedEmail.trim().toLowerCase(),
          password: signUpPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      // If Supabase requires email verification, switch to 6-digit OTP view
      if (data.requiresVerification) {
        setMode('otp');
        setInfoMsg(data.message || 'Verification code sent! Please check your inbox.');
        return;
      }

      if (data.user) {
        signInAsClient(
          data.user.name,
          data.user.email,
          data.user.walletBalance,
          data.user.id,
          data.user.role
        );
        toast.success(`Account created! Welcome, ${data.user.name || 'Creator'}!`);
        if (isPage) {
          router.refresh();
        }
        onSuccess?.(data.user);
        onClose?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle OTP Code Verification
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      setErrorMsg('Please enter the full 6-digit verification code.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sharedEmail.trim().toLowerCase(),
          token: otpCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid verification code. Please check your email.');
      }

      if (data.user) {
        signInAsClient(
          data.user.name,
          data.user.email,
          data.user.walletBalance,
          data.user.id,
          data.user.role
        );
        toast.success(`Email verified! Welcome, ${data.user.name || 'Creator'}!`);
        if (isPage) {
          router.refresh();
        }
        onSuccess?.(data.user);
        onClose?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    setIsResendingOtp(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sharedEmail.trim().toLowerCase(),
          action: 'resend',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('A fresh 6-digit code has been sent to your email.');
        setInfoMsg(data.message || 'Fresh code sent to your email.');
      }
    } catch {
      toast.error('Could not resend code. Please try again shortly.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Reusable Tab Switcher from @/components/ui/tabs */}
      {mode !== 'otp' && (
        <Tabs
          value={mode}
          onValueChange={(val) => switchMode(val as AuthFormMode)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 p-1 bg-secondary/60">
            <TabsTrigger value="signin" className="text-xs font-semibold py-1.5">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" className="text-xs font-semibold py-1.5">
              Create Account
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Inline Notifications */}
      {errorMsg && (
        <Alert variant="destructive" className="py-2.5 px-3 text-xs animate-in fade-in-50">
          <AlertCircle className="size-4 shrink-0" />
          <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {infoMsg && (
        <Alert className="py-2.5 px-3 text-xs border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 animate-in fade-in-50">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-xs font-medium">{infoMsg}</AlertDescription>
        </Alert>
      )}

      {/* ================================================================= */}
      {/* MODE 1: SIGN IN FORM                                              */}
      {/* ================================================================= */}
      {mode === 'signin' && (
        <form onSubmit={handleSignIn} className="space-y-3.5" noValidate={false}>
          <div className="space-y-1.5">
            <Label htmlFor="auth-signin-email" className="text-xs font-semibold text-foreground">
              Email
            </Label>
            <Input
              ref={emailInputRef}
              id="auth-signin-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              value={sharedEmail}
              onChange={(e) => setSharedEmail(e.target.value)}
              className="h-10 text-base md:text-sm bg-background/50 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="auth-signin-password" className="text-xs font-semibold text-foreground">
                Password
              </Label>
              <Link
                href="/login?forgot=true"
                className="text-xs font-medium text-muted-foreground hover:text-brand-text hover:underline transition-colors"
                tabIndex={0}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="auth-signin-password"
                name="password"
                type={showSignInPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                className="h-10 text-base md:text-sm bg-background/50 pr-10 rounded-lg"
              />
              <button
                type="button"
                aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowSignInPassword(!showSignInPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showSignInPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            loading={isLoading}
            loadingText="Signing in..."
            className="w-full font-bold shadow-xs cursor-pointer"
          >
            Sign In
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-0.5">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-brand-text hover:underline font-bold cursor-pointer"
            >
              Sign up
            </button>
          </p>
        </form>
      )}

      {/* ================================================================= */}
      {/* MODE 2: CREATE ACCOUNT FORM                                       */}
      {/* ================================================================= */}
      {mode === 'signup' && (
        <form onSubmit={handleSignUp} className="space-y-3.5" noValidate={false}>
          <div className="space-y-1.5">
            <Label htmlFor="auth-signup-name" className="text-xs font-semibold text-foreground">
              Name or Brand
            </Label>
            <Input
              ref={nameInputRef}
              id="auth-signup-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="e.g. Alex Studio"
              value={signUpName}
              onChange={(e) => setSignUpName(e.target.value)}
              className="h-10 text-base md:text-sm bg-background/50 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-signup-email" className="text-xs font-semibold text-foreground">
              Email
            </Label>
            <Input
              id="auth-signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              value={sharedEmail}
              onChange={(e) => setSharedEmail(e.target.value)}
              className="h-10 text-base md:text-sm bg-background/50 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-signup-password" className="text-xs font-semibold text-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="auth-signup-password"
                name="password"
                type={showSignUpPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Min. 8 characters"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                className="h-10 text-base md:text-sm bg-background/50 pr-10 rounded-lg"
              />
              <button
                type="button"
                aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showSignUpPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            loading={isLoading}
            loadingText="Creating account..."
            className="w-full font-bold shadow-xs cursor-pointer"
          >
            Create Account
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-0.5">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-brand-text hover:underline font-bold cursor-pointer"
            >
              Sign in
            </button>
          </p>
        </form>
      )}

      {/* ================================================================= */}
      {/* MODE 3: 6-DIGIT OTP VERIFICATION FORM                             */}
      {/* ================================================================= */}
      {mode === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-foreground">{sharedEmail}</span>
            </p>
          </div>

          <div className="flex justify-center py-2">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={otpCode.length < 6}
            loading={isLoading}
            loadingText="Verifying..."
            className="w-full font-bold shadow-xs cursor-pointer"
          >
            Verify Code
          </Button>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isResendingOtp}
              className="text-brand-text hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              {isResendingOtp ? 'Resending...' : 'Resend code'}
            </button>

            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              Change email
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
