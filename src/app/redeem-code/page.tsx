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
import { TabsContent } from '@/components/ui/tabs';
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

export default function RedeemCodePage() {
  const [tab, setTab] = useState('redeem');

  // Generator State
  const [credits, setCredits] = useState(150);
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Redemption State
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemedAmount, setRedeemedAmount] = useState<number | null>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `HT-${credits}CR-${randomSuffix}`;
    setGeneratedCode(code);
    setCopied(false);
    toast.success(`Generated voucher code for ${credits} CR!`);
  };

  const copyToClipboard = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success('Voucher code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode || redeemCode.length < 6) {
      toast.error('Please enter a valid 6-character voucher code');
      return;
    }

    setIsRedeeming(true);
    setTimeout(() => {
      setIsRedeeming(false);
      const simulatedCredits = 150;
      setRedeemedAmount(simulatedCredits);
      toast.success(`Success! Voucher redeemed for ${simulatedCredits} CR added to your wallet.`);
    }, 700);
  };

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={
        <Link href="/">
          <Button variant="outline" size="sm" className="text-xs rounded-xl cursor-pointer">
            Open Studio Wizard
          </Button>
        </Link>
      }
    >
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Step Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="warning-light" size="xs">
                PROMOTIONAL TOOLKIT
              </Badge>
              <Badge variant="outline" size="xs">
                Voucher Engine
              </Badge>
            </div>
            <h1 className="scroll-m-20 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground lg:text-4xl">
              Credit Vouchers &amp; Promo Passes
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Redeem promo passes directly into your wallet, or generate single-use passes for partners and creators.
            </p>
          </div>
        </div>

        {/* Mode Tabs */}
        <FilterTabs
          value={tab}
          onValueChange={(val) => setTab(val as string)}
          size="sm"
          className="w-full"
          listClassName="w-full sm:w-auto"
          tabs={[
            { value: 'redeem', label: 'Redeem Promo Code', icon: Gift },
            { value: 'generate', label: 'Generate Partner Pass', icon: Ticket },
          ]}
        >

          {/* TAB 1: Redeem Existing Code */}
          <TabsContent value="redeem" className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-4">
                <Card className="rounded-2xl border-border bg-card shadow-sm">
                  <CardHeader className="p-6 pb-3">
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      <Gift className="w-4 h-4 text-amber-600" /> Claim Creator Credits
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      Enter the 6-character promotional code received from your sponsorship manager, event, or partner grant.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-6 pt-2">
                    <form onSubmit={handleRedeem} className="space-y-5">
                      <Field>
                        <FieldLabel className="text-sm font-bold text-foreground">
                          Promotional Pass Code
                        </FieldLabel>
                        <FieldDescription className="text-xs">
                          Type or paste the authorization pass code.
                        </FieldDescription>

                        <div className="pt-2 flex flex-col items-center sm:items-start gap-3">
                          <InputOTP
                            maxLength={6}
                            value={redeemCode}
                            onChange={(val) => {
                              // One-paste auto-split: cleans codes like HT-9428 or HT-150CR-ABCD
                              const cleaned = val.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
                              setRedeemCode(cleaned);
                            }}
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} className="size-9 sm:size-10 text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-500 data-[active=true]:ring-amber-500/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                              <InputOTPSlot index={1} className="size-9 sm:size-10 text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-500 data-[active=true]:ring-amber-500/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                              <InputOTPSlot index={2} className="size-9 sm:size-10 text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-500 data-[active=true]:ring-amber-500/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              <InputOTPSlot index={3} className="size-9 sm:size-10 text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-500 data-[active=true]:ring-amber-500/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                              <InputOTPSlot index={4} className="size-9 sm:size-10 text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-500 data-[active=true]:ring-amber-500/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                              <InputOTPSlot index={5} className="size-9 sm:size-10 text-sm font-mono font-bold bg-card border-border/80 rounded-lg data-[active=true]:border-amber-500 data-[active=true]:ring-amber-500/25 data-[active=true]:ring-2 shadow-2xs transition-all" />
                            </InputOTPGroup>
                          </InputOTP>

                          <div className="flex gap-2 w-full max-w-sm mt-1">
                            <Input
                              type="text"
                              placeholder="Or paste code e.g. HT-9428"
                              value={redeemCode}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
                                setRedeemCode(cleaned);
                              }}
                              className="h-9 text-xs font-mono uppercase rounded-lg border-border/80 focus-visible:border-amber-500"
                            />
                            <Button
                              type="submit"
                              disabled={isRedeeming || !redeemCode}
                              className="shrink-0 h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                            >
                              <span>{isRedeeming ? 'Applying…' : 'Redeem'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </Field>
                    </form>
                  </CardContent>
                </Card>

                {redeemedAmount && (
                  <Alert variant="success" className="rounded-2xl border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <AlertTitle className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      Credits Added to Studio Balance!
                    </AlertTitle>
                    <AlertDescription className="text-xs text-emerald-800/90 dark:text-emerald-300">
                      Your voucher successfully applied <b className="font-mono">{redeemedAmount} CR</b> to your creator balance. You can allocate them to any video, branding, or 3D package right now in the wizard.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert variant="info" className="rounded-2xl">
                  <ShieldCheck className="w-4 h-4" />
                  <AlertTitle className="text-sm font-bold">Voucher Terms &amp; Security</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed">
                    Each pass is single-use and valid for creative services at Humantek Creator Credit Studio. Credits do not expire once credited to your account.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Sidebar Quick Card */}
              <div className="lg:col-span-5">
                <Card className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
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
          </TabsContent>

          {/* TAB 2: Generate Partner Pass */}
          <TabsContent value="generate" className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form */}
              <div className="lg:col-span-6 space-y-4">
                <Card className="rounded-2xl border-border bg-card shadow-sm">
                  <CardHeader className="p-6 pb-2">
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-amber-600" /> Voucher Parameters
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      Configure credit value and recipient assignment for this voucher.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-6 pt-2">
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
                            className="h-10 text-sm font-mono rounded-xl"
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
                            className="rounded-xl text-sm h-10"
                          />
                        </Field>

                        <Field>
                          <FieldLabel className="text-sm font-bold text-foreground">Internal Campaign Note</FieldLabel>
                          <Input
                            type="text"
                            placeholder="e.g. Q4 Sponsorship Grant"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="rounded-xl text-sm h-10"
                          />
                        </Field>
                      </FieldGroup>

                      <Button type="submit" variant="default" size="default" className="w-full text-sm font-semibold h-10">
                        Generate Secure Voucher Code
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Alert variant="info" className="rounded-2xl">
                  <ShieldCheck className="w-4 h-4" />
                  <AlertTitle className="text-sm font-bold">Single-Use Voucher Security</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed">
                    Generated codes can be applied once during checkout or redeemed directly on this page. Credits are non-refundable.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Luxury Card Preview */}
              <div className="lg:col-span-6">
                <Card className="p-8 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50/70 via-card to-amber-100/30 dark:from-amber-950/30 dark:via-card dark:to-amber-950/20 shadow-md flex flex-col justify-between min-h-[340px]">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm uppercase tracking-wider text-amber-800 dark:text-amber-300 font-extrabold">
                        Humantek Creator Pass
                      </span>
                      <Sparkles className="w-4 h-4 text-amber-600" />
                    </div>

                    <div className="my-8">
                      <CreditValue value={credits} size="hero" className="block" />
                      <small className="text-muted-foreground text-sm block mt-1">
                        Redeemable against any approved Humantek Art creative services.
                      </small>
                    </div>

                    {generatedCode ? (
                      <div className="p-4 bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-xl flex items-center justify-between mt-4 shadow-2xs">
                        <span className="font-mono text-base font-bold text-amber-900 dark:text-amber-200 tracking-wider">
                          {generatedCode}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={copyToClipboard}
                          className="h-9 px-3 text-amber-800 dark:text-amber-200 hover:text-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer rounded-lg"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 bg-secondary/60 border border-border rounded-xl text-center text-sm text-muted-foreground">
                        Configure parameters and click Generate to produce code.
                      </div>
                    )}
                  </div>

                  <Separator className="my-4 bg-border/70" />
                  <div className="text-xs text-muted-foreground font-medium">
                    Recipient: <b className="text-foreground">{recipient || 'Open Creator Pass'}</b> · Single-use authorization only.
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </FilterTabs>
      </div>
    </StudioCardLayout>
  );
}
