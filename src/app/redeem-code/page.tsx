'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CreditValue } from '@/components/ui/credit-value';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { FilterTabs } from '@/components/ui/filter-tabs';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldGroup,
} from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Ticket,
  Sparkles,
  ShieldCheck,
  Gift,
  ArrowRight,
  Wallet,
} from 'lucide-react';

import { useUserStore } from '@/lib/userStore';
import { useWalletQuery, useRedeemPromoCode } from '@/lib/queries/wallet';
import { useNotificationStore } from '@/lib/notificationStore';

export default function RedeemCodePage() {
  const { user } = useUserStore();
  const walletQuery = useWalletQuery(user?.email);
  const redeemMutation = useRedeemPromoCode();
  const [tab, setTab] = useState('redeem');

  // Generator State
  const [credits, setCredits] = useState(150);
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Redemption State
  const [redeemCode, setRedeemCode] = useState('');
  const isRedeeming = redeemMutation.isPending;
  const [redeemedAmount, setRedeemedAmount] = useState<number | null>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `HT-${credits}CR-${randomSuffix}`;
    setGeneratedCode(code);
    setCopied(false);
    toast.success(`Generated promo code for ${credits} CR!`);
  };

  const copyToClipboard = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success('Promo code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = (redeemCode || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      toast.error('Please enter a valid promo code');
      return;
    }

    try {
      const data = await redeemMutation.mutateAsync({
        code: cleanCode,
        email: user?.email,
      });

      setRedeemedAmount(data.creditsAdded);
      setRedeemCode('');
      useNotificationStore.getState().addNotification({
        title: 'Promo Code Redeemed',
        description: `+${data.creditsAdded} CR deposited into your wallet. New balance: ${data.newWalletBalance} CR.`,
        iconType: 'credits',
        link: '/redeem-code',
      });
      toast.success(
        data.message || `Success! ${data.creditsAdded} CR deposited into your Studio Wallet. New balance: ${data.newWalletBalance} CR.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redemption failed';
      toast.error(msg);
    }
  };

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={
        <Link href="/new-project">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 px-2.5 sm:px-3 rounded-md text-xs font-bold gap-1 shadow-xs bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground cursor-pointer shadow-amber-400/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden min-[400px]:inline">New Project</span>
            <span className="min-[400px]:hidden">New</span>
          </Button>
        </Link>
      }
    >
      <div className="space-y-6 animate-in fade-in duration-200 pb-24 sm:pb-12">
        {/* Step Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              CREATOR WALLET &amp; PASSES
            </div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Promo Code &amp; Passes
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Redeem promo codes directly into your wallet, or generate passes for partners and creators.
            </p>
          </div>
        </div>

        {/* Mode Tabs (Responsive Segmented Control) */}
        <FilterTabs
          value={tab}
          onValueChange={(val) => setTab(val as string)}
          size="sm"
          className="w-full"
          listClassName="w-full sm:w-auto grid grid-cols-2 sm:inline-flex"
          tabs={[
            { value: 'redeem', label: 'Redeem Code', icon: Gift },
            { value: 'generate', label: 'Generate Pass', icon: Ticket },
          ]}
        />

        {/* TAB 1: Redeem Existing Code */}
        {tab === 'redeem' ? (
          <div className="pt-1 sm:pt-2 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start">
              <div className="lg:col-span-7 space-y-4">
                <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
                  <CardHeader className="p-4 sm:p-6 pb-2.5 sm:pb-3">
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      <Gift className="w-4 h-4 text-brand-text dark:text-amber-400" /> Claim Creator Credits
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                      Enter the 6-character promotional code received from your sponsorship manager, event, or partner grant.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-6 pt-2">
                    <form onSubmit={handleRedeem} className="space-y-4 sm:space-y-5">
                      <Field>
                        <FieldLabel className="text-sm font-bold text-foreground">
                          Promotional Pass Code
                        </FieldLabel>
                        <FieldDescription className="text-xs">
                          Type or paste the authorization pass code.
                        </FieldDescription>

                        <div className="pt-2 flex flex-col items-center sm:items-start gap-3 w-full">
                          <InputOTP
                            maxLength={6}
                            value={redeemCode}
                            onChange={(val) => {
                              // One-paste auto-split: cleans codes like HT-9428 or HT-150CR-ABCD
                              const cleaned = val.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
                              setRedeemCode(cleaned);
                            }}
                            className="max-w-full"
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} className="size-8 xs:size-9 sm:size-10 text-xs sm:text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-400 data-[active=true]:ring-amber-400/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                              <InputOTPSlot index={1} className="size-8 xs:size-9 sm:size-10 text-xs sm:text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-400 data-[active=true]:ring-amber-400/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                              <InputOTPSlot index={2} className="size-8 xs:size-9 sm:size-10 text-xs sm:text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-400 data-[active=true]:ring-amber-400/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              <InputOTPSlot index={3} className="size-8 xs:size-9 sm:size-10 text-xs sm:text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-400 data-[active=true]:ring-amber-400/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                              <InputOTPSlot index={4} className="size-8 xs:size-9 sm:size-10 text-xs sm:text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-400 data-[active=true]:ring-amber-400/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                              <InputOTPSlot index={5} className="size-8 xs:size-9 sm:size-10 text-xs sm:text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-400 data-[active=true]:ring-amber-400/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                            </InputOTPGroup>
                          </InputOTP>

                          <div className="flex flex-col xs:flex-row gap-2 w-full max-w-sm mt-1">
                            <Input
                              type="text"
                              placeholder="Or paste code e.g. HT-9428"
                              value={redeemCode}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
                                setRedeemCode(cleaned);
                              }}
                              className="h-9 text-xs font-mono uppercase rounded-lg border-border/80 focus-visible:border-amber-400 focus-visible:ring-amber-400/25 w-full"
                            />
                            <Button
                              type="submit"
                              loading={isRedeeming}
                              loadingText="Applying…"
                              disabled={!redeemCode}
                              className="shrink-0 h-9 px-3.5 text-xs font-bold gap-1.5 rounded-lg bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground shadow-xs cursor-pointer w-full xs:w-auto justify-center"
                            >
                              <span>Redeem</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </Field>
                    </form>
                  </CardContent>
                </Card>

                {redeemedAmount && (
                  <Alert variant="success" className="rounded-xl border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <AlertTitle className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      Credits added to credit balance!
                    </AlertTitle>
                    <AlertDescription className="text-xs text-emerald-800/90 dark:text-emerald-300">
                      Your promo code successfully added <b className="font-mono tabular-nums">{redeemedAmount} CR</b> to your creator balance. You can use them for any project right now.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert variant="info" className="rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                  <AlertTitle className="text-sm font-bold">Promo Code Terms &amp; Security</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed">
                    Each code is single-use and valid for creative services at Humantek Creator Credit Studio. Credits do not expire once credited to your account.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Sidebar Quick Card */}
              <div className="lg:col-span-5">
                <Card className="p-4 sm:p-6 rounded-xl border border-border/80 bg-card shadow-xs space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-brand-text dark:text-amber-400 flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Need a Custom Grant?</h4>
                      <p className="text-xs text-muted-foreground">For enterprise sponsorship and bulk studio seats.</p>
                    </div>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Agency partners and esports organizations can request custom bulk credit allocations with volume billing and priority creative queue access.
                  </p>
                  <Link href="/management" className="block">
                    <Button variant="outline" size="sm" className="w-full text-xs font-semibold h-9 rounded-xl">
                      Open Agency Management
                    </Button>
                  </Link>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: Generate Partner Pass */
          <div className="pt-1 sm:pt-2 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start">
              {/* Form */}
              <div className="lg:col-span-6 space-y-4">
                <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
                  <CardHeader className="p-4 sm:p-6 pb-2">
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-brand-text dark:text-amber-400" /> Promo Code Parameters
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                      Configure credit value and recipient assignment for this promo code.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-6 pt-2">
                    <form onSubmit={handleGenerate} className="space-y-4">
                      <FieldGroup>
                        <Field>
                          <div className="flex items-center justify-between">
                            <FieldLabel className="text-sm font-bold text-foreground">Credit Amount (CR)</FieldLabel>
                            <CreditValue value={credits} size="sm" variant="pill" showUsd />
                          </div>

                          <Slider
                            value={[credits]}
                            min={25}
                            max={1500}
                            step={25}
                            onValueChange={(val) => {
                              const num = Array.isArray(val) ? val[0] : val;
                              setCredits(num);
                            }}
                            className="py-2"
                          />

                          <Input
                            type="number"
                            min="10"
                            max="5000"
                            step="10"
                            value={credits}
                            onChange={(e) => setCredits(Number(e.target.value))}
                            className="h-9 text-sm font-mono tabular-nums rounded-lg"
                            required
                          />
                        </Field>

                        <Field>
                          <FieldLabel className="text-sm font-bold text-foreground">
                            Recipient or Channel (Optional)
                          </FieldLabel>
                          <Input
                            type="text"
                            placeholder="e.g. Creator Twitch Partner"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="h-9 rounded-lg text-sm"
                          />
                        </Field>

                        <Field>
                          <FieldLabel className="text-sm font-bold text-foreground">Internal Campaign Note</FieldLabel>
                          <Input
                            type="text"
                            placeholder="e.g. Q4 Sponsorship Grant"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="h-9 rounded-lg text-sm"
                          />
                        </Field>
                      </FieldGroup>

                      <Button type="submit" variant="default" className="w-full h-9 rounded-lg text-sm font-semibold cursor-pointer">
                        Generate Promo Code
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Alert variant="info" className="rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                  <AlertTitle className="text-sm font-bold">Single-Use Code Security</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed">
                    Generated codes can be applied once during checkout or redeemed directly on this page. Credits are non-refundable.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Luxury Card Preview */}
              <div className="lg:col-span-6">
                <Card className="p-4 sm:p-6 md:p-8 rounded-xl border border-amber-400/40 dark:border-amber-700/60 bg-gradient-to-br from-amber-400/[0.08] via-card to-amber-400/[0.04] dark:from-amber-950/30 dark:via-card dark:to-amber-950/20 shadow-xs flex flex-col justify-between min-h-[260px] sm:min-h-[340px]">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm uppercase tracking-wider text-brand-text dark:text-amber-300 font-extrabold">
                        Humantek Creator Pass
                      </span>
                      <Sparkles className="w-4 h-4 text-brand-text dark:text-amber-400" />
                    </div>

                    <div className="my-4 sm:my-8">
                      <CreditValue value={credits} size="lg" className="block sm:hidden" />
                      <CreditValue value={credits} size="hero" className="hidden sm:block" />
                      <small className="text-muted-foreground text-xs sm:text-sm block mt-1">
                        Redeemable against any approved Humantek Art creative services.
                      </small>
                    </div>

                    {generatedCode ? (
                      <div className="p-3 sm:p-4 bg-amber-50/90 dark:bg-amber-950/60 border border-amber-400/40 dark:border-amber-700 rounded-xl flex items-center justify-between gap-2 mt-4 shadow-2xs">
                        <span className="font-mono tabular-nums text-xs sm:text-base font-bold text-amber-900 dark:text-amber-200 tracking-wider break-all">
                          {generatedCode}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={copyToClipboard}
                          className="h-8 sm:h-9 px-2.5 sm:px-3 text-brand-text dark:text-amber-300 hover:bg-amber-400/15 cursor-pointer rounded-lg shrink-0"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="p-3.5 sm:p-4 bg-secondary/60 border border-border rounded-xl text-center text-xs sm:text-sm text-muted-foreground">
                        Configure parameters and click Generate to produce code.
                      </div>
                    )}
                  </div>

                  <Separator className="my-4 bg-border/70" />
                  <div className="text-2xs sm:text-xs text-muted-foreground font-medium break-words">
                    Recipient: <b className="text-foreground">{recipient || 'Open Creator Pass'}</b> · Single-use authorization only.
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudioCardLayout>
  );
}
