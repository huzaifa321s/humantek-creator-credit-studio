'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { AlertCircle, CheckCircle2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useUserStore, StudioUser } from '@/lib/userStore';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { bypassUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

export type AuthFormMode = 'signin' | 'signup' | 'otp' | 'forgot' | 'reset-otp' | 'reset-link';

export interface AuthFormProps {
  initialMode?: AuthFormMode;
  defaultEmail?: string;
  onSuccess?: (user: StudioUser) => void;
  onClose?: () => void;
  isPage?: boolean;
  nextUrl?: string;
  showGoogle?: boolean;
}

export function AuthForm({
  initialMode = 'signin',
  defaultEmail = '',
  onSuccess,
  onClose,
  isPage = false,
  nextUrl = '/projects',
  showGoogle = true,
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

  // OTP & Password Recovery fields
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Sync mode when initialMode changes externally (e.g. URL query params ?forgot=true or ?reset=true)
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Countdown timer for OTP / recovery resend cooldown
  useEffect(() => {
    if ((mode === 'otp' || mode === 'reset-otp') && resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [mode, resendCooldown]);

  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Refs for accessible focus management
  const emailInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const newPasswordInputRef = useRef<HTMLInputElement>(null);

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
      } else if (mode === 'signin' || mode === 'forgot') {
        emailInputRef.current?.focus();
      } else if (mode === 'reset-link') {
        newPasswordInputRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [mode]);

  // Check for OAuth cancellation, error message, or ?forgot=true / ?reset=true in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const urlError = url.searchParams.get('error');
      if (urlError) {
        setErrorMsg(urlError);
      }
      if (url.searchParams.get('reset') === 'true') {
        setMode('reset-link');
        setInfoMsg('Recovery verified. Enter your new password below.');
      } else if (url.searchParams.get('forgot') === 'true' && initialMode === 'signin') {
        setMode('forgot');
      }
    }
  }, [initialMode]);

  // Handle Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    // Explicitly bypass beforeunload warning so browser does not prompt when redirecting to Google OAuth
    bypassUnsavedChangesWarning(true);
    try {
      setIsLoading(true);
      setErrorMsg('');
      const supabase = createClient();

      // Check if user has an active wizard draft in localStorage to restore cart
      let targetPath = nextUrl || '/projects';
      if (typeof window !== 'undefined') {
        try {
          const storedDraft = localStorage.getItem('humantek_wizard_cart');
          if (storedDraft) {
            const parsed = JSON.parse(storedDraft);
            const hasPkg = parsed?.state?.selectedPackageId || parsed?.selectedPackageId;
            const isWallet = parsed?.state?.fundingSource === 'wallet' || parsed?.fundingSource === 'wallet';
            if (hasPkg || isWallet) {
              targetPath = '/new-project?step=5';
            }
          }
        } catch {}
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(targetPath)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: unknown) {
      bypassUnsavedChangesWarning(false);
      const msg = err instanceof Error ? err.message : 'Failed to connect with Google.';
      setErrorMsg(msg);
      setIsLoading(false);
    }
  };

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
          data.user.role,
          data.user.avatarUrl || null,
          data.user.teamRole || null
        );

        if (data.user.role === 'admin' || data.user.isAdmin) {
          toast.success('Welcome back, Administrator. Redirecting to management console...');
          onClose?.();
          window.location.replace('/management');
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
        if (data.alreadyRegistered || data.error?.toLowerCase().includes('already')) {
          setMode('signin');
          if (signUpPassword) {
            setSignInPassword(signUpPassword);
          }
          setErrorMsg(data.error || 'An account with this email already exists. Please sign in with your password.');
          setInfoMsg('');
          return;
        }
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      // If Supabase requires email verification, switch to 6-digit OTP view
      if (data.requiresVerification) {
        setMode('otp');
        setOtpCode('');
        setResendCooldown(60);
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

  // 3. Handle OTP Code Verification (Sign Up)
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

  // Resend Signup OTP code
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
        setResendCooldown(data.cooldownSeconds || 60);
        toast.success('A fresh 6-digit code has been sent to your email.');
        setInfoMsg(data.message || 'Fresh code sent to your email.');
      } else {
        setErrorMsg(data.error || 'Could not resend code. Please try again.');
      }
    } catch {
      toast.error('Could not resend code. Please try again shortly.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  // 4. Handle Forgot Password Request (Send Recovery Code / Link)
  const handleRequestPasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanEmail = sharedEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter the email address associated with your account.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          email: cleanEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send password recovery instructions.');
      }

      setOtpCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResendCooldown(data.cooldownSeconds || 60);
      setMode('reset-otp');
      setInfoMsg(
        data.message ||
          'Recovery email sent! Enter the 6-digit code from your email (or click the link in the email) and choose a new password.'
      );
      toast.success('Password recovery instructions sent to your email.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request password reset.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Forgot Password Recovery Code
  const handleResendRecoveryCode = async () => {
    setIsResendingOtp(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          email: sharedEmail.trim().toLowerCase(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendCooldown(data.cooldownSeconds || 60);
        toast.success('A fresh recovery code has been sent to your email.');
        setInfoMsg(data.message || 'Fresh recovery code sent to your email.');
      } else {
        setErrorMsg(data.error || 'Could not resend recovery code. Please try again.');
      }
    } catch {
      toast.error('Could not resend recovery code. Please try again shortly.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  // 5. Handle Verify Recovery OTP + Set New Password
  const handleVerifyResetOtpAndPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      setErrorMsg('Please enter the 6-digit recovery code sent to your email.');
      return;
    }
    if (newPassword.trim().length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match. Please check and try again.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-and-reset',
          email: sharedEmail.trim().toLowerCase(),
          token: otpCode,
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reset password. Please check your code.');
      }

      if (data.user) {
        signInAsClient(
          data.user.name,
          data.user.email,
          data.user.walletBalance,
          data.user.id,
          data.user.role
        );
        toast.success('Password updated! You are now signed in.');
        if (data.user.role === 'admin' || data.user.isAdmin) {
          onClose?.();
          window.location.replace('/management');
          return;
        }
        if (isPage) {
          router.refresh();
        }
        onSuccess?.(data.user);
        onClose?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Handle Set New Password via Email Recovery Link Session (?reset=true)
  const handleUpdateSessionPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword.trim().length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match. Please check and try again.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-session-password',
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not update password. Your reset link may have expired.');
      }

      if (data.user) {
        signInAsClient(
          data.user.name,
          data.user.email,
          data.user.walletBalance,
          data.user.id,
          data.user.role
        );
        toast.success('Password updated! You are now signed in.');
        if (data.user.role === 'admin' || data.user.isAdmin) {
          onClose?.();
          window.location.replace('/management');
          return;
        }
        if (isPage) {
          router.refresh();
        }
        onSuccess?.(data.user);
        onClose?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password update failed.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Reusable Tab Switcher from @/components/ui/tabs (only shown in Sign In / Sign Up modes) */}
      {(mode === 'signin' || mode === 'signup') && (
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
          <AlertDescription className="text-xs font-medium">
            {errorMsg}
            {errorMsg.toLowerCase().includes('already') && mode === 'signup' && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="ml-1.5 underline font-bold hover:text-foreground cursor-pointer"
              >
                Sign In now &rarr;
              </button>
            )}
          </AlertDescription>
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
          {showGoogle && (
            <div className="space-y-3 pb-1">
              <Button
                type="button"
                variant="outline"
                size="lg"
                data-auth-google="true"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 h-10 border-border/80 bg-background/50 hover:bg-muted font-medium text-xs sm:text-sm transition-colors cursor-pointer"
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/70" />
                </div>
                <span className="relative bg-card px-2 text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                  or with email
                </span>
              </div>
            </div>
          )}

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
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-xs font-medium text-muted-foreground hover:text-brand-text hover:underline transition-colors cursor-pointer"
                tabIndex={0}
              >
                Forgot password?
              </button>
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
            <p className="text-2xs text-muted-foreground pt-0.5">
              Signed up with Google? Use the Google button above.
            </p>
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
          {showGoogle && (
            <div className="space-y-3 pb-1">
              <Button
                type="button"
                variant="outline"
                size="lg"
                data-auth-google="true"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 h-10 border-border/80 bg-background/50 hover:bg-muted font-medium text-xs sm:text-sm transition-colors cursor-pointer"
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/70" />
                </div>
                <span className="relative bg-card px-2 text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                  or with email
                </span>
              </div>
            </div>
          )}

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
      {/* MODE 3: 6-DIGIT OTP VERIFICATION FORM (SIGN UP)                   */}
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
              disabled={isResendingOtp || resendCooldown > 0}
              className="text-brand-text hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              {isResendingOtp
                ? 'Resending...'
                : resendCooldown > 0
                ? `Resend code (${resendCooldown}s)`
                : 'Resend code'}
            </button>

            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              Use a different email
            </button>
          </div>

          <div className="text-center pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-xs text-brand-text hover:underline font-bold cursor-pointer"
            >
              Already have an account? Sign in &rarr;
            </button>
          </div>
        </form>
      )}

      {/* ================================================================= */}
      {/* MODE 4: FORGOT PASSWORD — REQUEST RECOVERY EMAIL                  */}
      {/* ================================================================= */}
      {mode === 'forgot' && (
        <form onSubmit={handleRequestPasswordReset} className="space-y-4 pt-1">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Reset your password</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter your account email and we&apos;ll send a recovery code and password reset link.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-forgot-email" className="text-xs font-semibold text-foreground">
              Account Email
            </Label>
            <Input
              ref={emailInputRef}
              id="auth-forgot-email"
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

          <Button
            type="submit"
            size="lg"
            loading={isLoading}
            loadingText="Sending recovery email..."
            className="w-full font-bold shadow-xs cursor-pointer"
          >
            Send Reset Code
          </Button>

          <div className="text-center pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to Sign In
            </button>
          </div>
        </form>
      )}

      {/* ================================================================= */}
      {/* MODE 5: VERIFY 6-DIGIT RECOVERY CODE & SET NEW PASSWORD           */}
      {/* ================================================================= */}
      {mode === 'reset-otp' && (
        <form onSubmit={handleVerifyResetOtpAndPassword} className="space-y-3.5 pt-1">
          <div className="space-y-1 text-center">
            <h3 className="text-sm font-bold text-foreground">Enter Recovery Code</h3>
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-foreground">{sharedEmail}</span>
            </p>
          </div>

          <div className="flex justify-center py-1">
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

          <div className="space-y-1.5">
            <Label htmlFor="auth-reset-new-password" className="text-xs font-semibold text-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="auth-reset-new-password"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 text-base md:text-sm bg-background/50 pr-10 rounded-lg"
              />
              <button
                type="button"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-reset-confirm-password" className="text-xs font-semibold text-foreground">
              Confirm New Password
            </Label>
            <Input
              id="auth-reset-confirm-password"
              name="confirmPassword"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Re-enter new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="h-10 text-base md:text-sm bg-background/50 rounded-lg"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={otpCode.length < 6 || newPassword.length < 8}
            loading={isLoading}
            loadingText="Updating password..."
            className="w-full font-bold shadow-xs cursor-pointer"
          >
            Update Password &amp; Sign In
          </Button>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={handleResendRecoveryCode}
              disabled={isResendingOtp || resendCooldown > 0}
              className="text-brand-text hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              {isResendingOtp
                ? 'Resending...'
                : resendCooldown > 0
                ? `Resend code (${resendCooldown}s)`
                : 'Resend code'}
            </button>

            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              Change email
            </button>
          </div>

          <div className="text-center pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to Sign In
            </button>
          </div>
        </form>
      )}

      {/* ================================================================= */}
      {/* MODE 6: SET NEW PASSWORD VIA EMAIL RECOVERY LINK (?reset=true)    */}
      {/* ================================================================= */}
      {mode === 'reset-link' && (
        <form onSubmit={handleUpdateSessionPassword} className="space-y-3.5 pt-1">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Set a new password</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Choose a strong password (at least 8 characters) for your Studio account.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-link-new-password" className="text-xs font-semibold text-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                ref={newPasswordInputRef}
                id="auth-link-new-password"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 text-base md:text-sm bg-background/50 pr-10 rounded-lg"
              />
              <button
                type="button"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-link-confirm-password" className="text-xs font-semibold text-foreground">
              Confirm New Password
            </Label>
            <Input
              id="auth-link-confirm-password"
              name="confirmPassword"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Re-enter new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="h-10 text-base md:text-sm bg-background/50 rounded-lg"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={newPassword.length < 8}
            loading={isLoading}
            loadingText="Saving password..."
            className="w-full font-bold shadow-xs cursor-pointer"
          >
            Save New Password
          </Button>
        </form>
      )}
    </div>
  );
}
