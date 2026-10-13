'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TypographyH1, TypographyMuted } from '@/components/ui/typography';
import { StudioBackground } from '@/components/StudioBackground';
import { ShieldCheck, ShieldAlert, KeyRound, ArrowRight, QrCode } from 'lucide-react';
import { toast } from 'sonner';

export const dynamic = 'force-dynamic';

function AdminTotpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') || '/management';

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Enrollment state from Supabase MFA
  const [isEnrolled, setIsEnrolled] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  // Check enrollment on mount
  useEffect(() => {
    async function checkEnrollment() {
      try {
        setIsInitializing(true);
        const res = await fetch('/api/auth/admin-totp', { method: 'GET' });
        const data = await res.json();
        if (res.ok) {
          setIsEnrolled(data.enrolled);
          setFactorId(data.factorId);
          if (!data.enrolled) {
            // Request controlled enrollment via explicit POST
            const enrollRes = await fetch('/api/auth/admin-totp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'enroll' }),
            });
            const enrollData = await enrollRes.json();
            if (enrollRes.ok && enrollData.qrCode) {
              setFactorId(enrollData.factorId);
              setQrCodeSvg(enrollData.qrCode);
              setSecret(enrollData.secret);
            } else if (enrollData.error) {
              setErrorMsg(enrollData.error);
            }
          }
        }
      } catch (e) {
        console.warn('Could not query MFA status:', e);
      } finally {
        setIsInitializing(false);
      }
    }
    checkEnrollment();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      setErrorMsg('Please enter the full 6-digit code.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/admin-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          factorId,
          next: nextParam,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed. Please try again.');
      }

      toast.success('Two-factor verification confirmed', {
        description: 'Assurance level upgraded to AAL2. Opening Operations Console...',
      });

      router.replace(data.redirect || '/management');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background text-foreground overflow-hidden select-none font-sans">
      <StudioBackground variant="default" showDots={true} />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-secondary/80 border border-amber-400/30 shadow-xs mb-2">
            <KeyRound className="size-8 text-amber-500" />
          </div>
          <TypographyH1 className="text-2xl font-bold tracking-tight text-foreground">
            Two-Factor Authentication
          </TypographyH1>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="gold" size="sm" className="gap-1.5 font-semibold uppercase tracking-wider">
              <ShieldCheck className="size-2.5" />
              Staff Security (AAL2)
            </Badge>
          </div>
          <TypographyMuted className="text-xs text-muted-foreground max-w-xs mx-auto">
            {isEnrolled
              ? 'Enter the 6-digit security code from your authenticator app to authorize administrator access.'
              : 'Scan the QR code with your authenticator app (Google Authenticator, Authy) to link MFA.'}
          </TypographyMuted>
        </div>

        <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
              {!isEnrolled ? (
                <>
                  <QrCode className="size-4 text-brand-text" />
                  <span>Setup Administrator MFA</span>
                </>
              ) : (
                <span>Security Verification</span>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {!isEnrolled
                ? 'Scan the QR code below and enter the resulting 6-digit code to complete enrollment.'
                : 'Native Supabase MFA Authenticator assurance verification'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isInitializing ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2 text-muted-foreground text-xs">
                <div className="size-5 border-2 border-brand-text border-t-transparent rounded-full animate-spin" />
                <span>Checking MFA status...</span>
              </div>
            ) : (
              <form onSubmit={handleVerify} className="space-y-5">
                {errorMsg && (
                  <Alert variant="destructive" className="py-2.5 px-3 text-xs animate-in fade-in-50">
                    <ShieldAlert className="size-4 shrink-0 text-destructive" />
                    <AlertTitle className="text-xs font-semibold">Verification Error</AlertTitle>
                    <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
                  </Alert>
                )}

                {/* QR Code display for first-time MFA enrollment */}
                {!isEnrolled && qrCodeSvg && (
                  <div className="flex flex-col items-center justify-center p-4 bg-muted/40 border border-border/80 rounded-xl space-y-3">
                    <div
                      className="bg-white p-2.5 rounded-lg shadow-xs [&>svg]:size-40 [&>svg]:w-40 [&>svg]:h-40"
                      dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                    />
                    {secret && (
                      <div className="text-center space-y-1">
                        <span className="text-3xs uppercase tracking-wider text-muted-foreground font-medium">
                          Manual Entry Secret:
                        </span>
                        <div className="font-mono text-xs font-bold text-foreground tracking-widest select-all bg-background px-2.5 py-1 rounded border">
                          {secret}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col items-center justify-center py-2 space-y-2">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(val) => setCode(val)}
                    disabled={isLoading}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-2">
                      <InputOTPSlot index={0} className="size-11 text-lg font-mono rounded-lg border" />
                      <InputOTPSlot index={1} className="size-11 text-lg font-mono rounded-lg border" />
                      <InputOTPSlot index={2} className="size-11 text-lg font-mono rounded-lg border" />
                      <InputOTPSlot index={3} className="size-11 text-lg font-mono rounded-lg border" />
                      <InputOTPSlot index={4} className="size-11 text-lg font-mono rounded-lg border" />
                      <InputOTPSlot index={5} className="size-11 text-lg font-mono rounded-lg border" />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-2xs text-muted-foreground pt-1">
                    6-digit time-based code
                  </p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  loading={isLoading}
                  loadingText="Verifying security code..."
                  disabled={code.length < 6 || isLoading}
                  className="w-full font-bold shadow-xs cursor-pointer"
                >
                  <span>{isEnrolled ? 'Verify & Proceed' : 'Enroll & Proceed'}</span>
                  <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminTotpPage() {
  return (
    <Suspense fallback={null}>
      <AdminTotpContent />
    </Suspense>
  );
}
