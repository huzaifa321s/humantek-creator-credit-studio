'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { FilterTabs } from '@/components/ui/filter-tabs';
import { CopyButton } from '@/components/ui/copy-button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Field,
  FieldLabel,
  FieldDescription,
} from '@/components/ui/field';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { toast } from 'sonner';
import {
  Check,
  ShieldCheck,
  Gift,
  ArrowRight,
  Wallet,
  Send,
  Sparkles,
  Clock,
  Mail,
  Ticket,
} from 'lucide-react';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';

import { useUserStore } from '@/lib/userStore';
import {
  useWalletQuery,
  useRedeemPromoCode,
  useGiftPromoCodesQuery,
  useCreateGiftPromoCode,
  type GiftPromoRecordItem,
} from '@/lib/queries/wallet';
import { useNotificationStore } from '@/lib/notificationStore';
import { cn, formatStudioDate } from '@/lib/utils';

type PromoPageTab = 'redeem' | 'share';

const QUICK_CREDIT_PRESETS = [10, 25, 50, 100];

function RedeemCodeContent() {
  const searchParams = useSearchParams();
  const { user } = useUserStore();
  const walletQuery = useWalletQuery(user?.email);
  const giftsQuery = useGiftPromoCodesQuery(user?.email);
  const redeemMutation = useRedeemPromoCode();
  const createGiftMutation = useCreateGiftPromoCode();

  const initialTabParam = searchParams.get('tab');
  const initialCodeParam = searchParams.get('code');

  const [activeTab, setActiveTab] = useState<PromoPageTab>(() =>
    initialTabParam === 'share' ? 'share' : 'redeem'
  );

  // Sync URL params when deep-linked
  useEffect(() => {
    if (initialTabParam === 'share') {
      setActiveTab('share');
    } else if (initialTabParam === 'redeem' || initialCodeParam) {
      setActiveTab('redeem');
    }
  }, [initialTabParam, initialCodeParam]);

  // ─── Tab 1: Redeem State ─────────────────────────────────────────────────
  const [redeemCode, setRedeemCode] = useState(() =>
    initialCodeParam ? initialCodeParam.trim().toUpperCase() : ''
  );
  useEffect(() => {
    if (initialCodeParam) {
      setRedeemCode(initialCodeParam.trim().toUpperCase());
    }
  }, [initialCodeParam]);

  const isRedeeming = redeemMutation.isPending;
  const [redeemedResult, setRedeemedResult] = useState<{
    creditsAdded: number;
    code: string;
    sharedBy?: { name: string; email: string; note?: string } | null;
  } | null>(null);

  // ─── Tab 2: Share / Gift State ───────────────────────────────────────────
  const [recipientEmail, setRecipientEmail] = useState('');
  const [creditsInput, setCreditsInput] = useState('25');
  const [giftNote, setGiftNote] = useState('');
  const [latestGeneratedGift, setLatestGeneratedGift] = useState<GiftPromoRecordItem | null>(null);
  const isGenerating = createGiftMutation.isPending;

  const walletBalance = walletQuery.data?.walletBalance ?? user?.walletBalance ?? 0;
  const sentGifts = useMemo(() => giftsQuery.data?.sentGifts ?? [], [giftsQuery.data?.sentGifts]);
  const unclaimedReceivedGifts = useMemo(
    () => (giftsQuery.data?.receivedGifts ?? []).filter((g) => g.status === 'active'),
    [giftsQuery.data?.receivedGifts]
  );

  const parsedCreditsToShare = useMemo(() => {
    const num = parseInt(creditsInput, 10);
    return Number.isNaN(num) ? 0 : num;
  }, [creditsInput]);

  const handleRedeem = async (e: React.FormEvent, overrideCode?: string) => {
    e.preventDefault();
    const cleanCode = (overrideCode ?? redeemCode ?? '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      toast.error('Please enter a valid promo code');
      return;
    }

    try {
      const data = await redeemMutation.mutateAsync({
        code: cleanCode,
        email: user?.email,
      });

      setRedeemedResult({
        creditsAdded: data.creditsAdded,
        code: data.code,
        sharedBy: data.sharedBy ?? null,
      });
      setRedeemCode('');
      useNotificationStore.getState().addNotification({
        title: data.sharedBy ? 'Gift Promo Code Claimed' : 'Promo Code Redeemed',
        description: data.sharedBy
          ? `+${data.creditsAdded} CR shared by ${data.sharedBy.name} added to your wallet. New balance: ${data.newWalletBalance} CR.`
          : `+${data.creditsAdded} CR deposited into your wallet. New balance: ${data.newWalletBalance} CR.`,
        iconType: 'credits',
        link: '/redeem-code',
      });
      toast.success(
        data.message ||
          `Success! ${data.creditsAdded} CR deposited into your Studio Wallet. New balance: ${data.newWalletBalance} CR.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redemption failed';
      toast.error(msg);
    }
  };

  const handleGenerateGift = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRecipient = recipientEmail.trim().toLowerCase();
    if (!cleanRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanRecipient)) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }
    if (user?.email && cleanRecipient === user.email.trim().toLowerCase()) {
      toast.error('Please enter a friend or family member’s email address, not your own.');
      return;
    }
    if (!Number.isInteger(parsedCreditsToShare) || parsedCreditsToShare < 1) {
      toast.error('Please enter at least 1 CR to share.');
      return;
    }
    if (parsedCreditsToShare > walletBalance) {
      toast.error(
        `Insufficient balance. You have ${walletBalance} CR available in your Studio Wallet.`
      );
      return;
    }

    try {
      const res = await createGiftMutation.mutateAsync({
        recipientEmail: cleanRecipient,
        credits: parsedCreditsToShare,
        note: giftNote.trim() || undefined,
      });

      setLatestGeneratedGift(res.gift);
      setRecipientEmail('');
      setGiftNote('');

      useNotificationStore.getState().addNotification({
        title: `Gift Code Generated · ${res.gift.credits} CR`,
        description: `Code ${res.gift.code} (${res.gift.credits} CR) created for ${res.gift.recipientEmail}.`,
        iconType: 'credits',
        link: '/redeem-code?tab=share',
      });

      toast.success(
        res.message ||
          `Generated ${res.gift.credits} CR gift promo code (${res.gift.code}) for ${res.gift.recipientEmail}!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate gift promo code';
      toast.error(msg);
    }
  };

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={<StudioNewProjectButton />}
    >
      <div className="space-y-6 animate-step-enter pb-24 sm:pb-12">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="text-2xs sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              CREATOR WALLET &amp; CREDIT SHARING
            </div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {activeTab === 'share' ? 'Share & Gift Studio Credits' : 'Redeem Promo Code'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              {activeTab === 'share'
                ? 'Generate a personal promo voucher from your wallet balance to share credits with a friend, family member, or collaborator.'
                : 'Claim a promotional studio voucher or a friend’s shared gift code directly into your Studio Wallet.'}
            </p>
          </div>

          <FilterTabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as PromoPageTab)}
            size="sm"
            tabs={[
              {
                value: 'redeem',
                label: 'Redeem Code',
                icon: Gift,
                count: unclaimedReceivedGifts.length > 0 ? unclaimedReceivedGifts.length : undefined,
              },
              {
                value: 'share',
                label: 'Share / Gift Credits',
                icon: Send,
                count: sentGifts.length > 0 ? sentGifts.length : undefined,
              },
            ]}
          />
        </div>

        <div className="pt-1 sm:pt-2 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start">
            {/* ================================================================= */}
            {/* LEFT COLUMN: ACTIVE TAB WORKSPACE                                 */}
            {/* ================================================================= */}
            <div className="lg:col-span-7 space-y-5">
              {activeTab === 'redeem' ? (
                <>
                  {/* Incoming Unclaimed Gift Codes Addressed to This User */}
                  {unclaimedReceivedGifts.length > 0 && (
                    <Card className="rounded-xl border border-amber-400/40 bg-amber-400/[0.06] shadow-xs">
                      <CardHeader className="p-4 sm:p-5 pb-2">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Sparkles className="size-4 text-brand-text dark:text-amber-400" />
                          <span>Gift Vouchers Waiting for You</span>
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          A creator shared studio credits with your email address ({user?.email}).
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-5 pt-2 space-y-2.5">
                        {unclaimedReceivedGifts.map((gift) => (
                          <div
                            key={gift.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-amber-400/30 bg-card/90"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs sm:text-sm font-extrabold text-brand-text dark:text-amber-400 tracking-wider">
                                  {gift.code}
                                </span>
                                <CreditValue value={gift.credits} size="sm" variant="pill" />
                              </div>
                              <p className="text-2xs text-muted-foreground truncate">
                                Shared by <b className="text-foreground/90">{gift.senderName}</b> ({gift.senderEmail})
                              </p>
                              {gift.note && (
                                <p className="text-2xs italic text-foreground/80">
                                  &ldquo;{gift.note}&rdquo;
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="gold"
                              size="sm"
                              loading={isRedeeming}
                              onClick={(e) => handleRedeem(e, gift.code)}
                              className="h-8 px-3 text-xs font-bold shrink-0 cursor-pointer"
                            >
                              Claim +{gift.credits} CR
                            </Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
                    <CardHeader className="p-4 sm:p-6 pb-2.5 sm:pb-3">
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <Gift className="w-4 h-4 text-brand-text dark:text-amber-400" /> Claim Creator Credits
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                        Enter a promo code shared by a friend or received from a studio grant.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-6 pt-2">
                      <form onSubmit={(e) => handleRedeem(e)} className="space-y-4 sm:space-y-5">
                        <Field>
                          <FieldLabel className="text-sm font-bold text-foreground">
                            Promotional or Gift Pass Code
                          </FieldLabel>
                          <FieldDescription className="text-xs">
                            Type or paste your code (e.g.{' '}
                            <span className="font-mono font-semibold text-foreground/80">
                              HT-GIFT-25CR-X9K2
                            </span>{' '}
                            or{' '}
                            <span className="font-mono font-semibold text-foreground/80">
                              WELCOME100
                            </span>
                            ).
                          </FieldDescription>

                          <div className="pt-2 flex flex-col xs:flex-row gap-2.5 w-full">
                            <Input
                              type="text"
                              maxLength={32}
                              placeholder="Enter or paste promo code..."
                              value={redeemCode}
                              onChange={(e) => {
                                const cleaned = e.target.value
                                  .replace(/[^A-Za-z0-9_-]/g, '')
                                  .slice(0, 32)
                                  .toUpperCase();
                                setRedeemCode(cleaned);
                              }}
                              className="h-10 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider rounded-lg border-border/80 focus-visible:border-amber-400 focus-visible:ring-amber-400/25 w-full"
                            />
                            <Button
                              type="submit"
                              variant="gold"
                              loading={isRedeeming}
                              loadingText="Applying…"
                              disabled={redeemCode.trim().length < 3}
                              className="shrink-0 h-10 px-4 text-xs sm:text-sm font-bold gap-1.5 cursor-pointer w-full xs:w-auto justify-center"
                            >
                              <span>Redeem</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </Field>
                      </form>
                    </CardContent>
                  </Card>

                  {redeemedResult && (
                    <Alert
                      variant="success"
                      className="rounded-xl border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20"
                    >
                      <Check className="w-4 h-4 text-emerald-600" />
                      <AlertTitle className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        +{redeemedResult.creditsAdded} CR added to your Studio Wallet!
                      </AlertTitle>
                      <AlertDescription className="text-xs text-emerald-800/90 dark:text-emerald-300 space-y-1">
                        <p>
                          Code <b className="font-mono">{redeemedResult.code}</b> successfully
                          added{' '}
                          <b className="font-mono tabular-nums">
                            {redeemedResult.creditsAdded} CR
                          </b>{' '}
                          to your creator balance.
                          {redeemedResult.sharedBy && (
                            <>
                              {' '}
                              Shared by <b>{redeemedResult.sharedBy.name}</b> (
                              {redeemedResult.sharedBy.email}).
                            </>
                          )}
                        </p>
                        {redeemedResult.sharedBy?.note && (
                          <p className="italic opacity-90">
                            Note: &ldquo;{redeemedResult.sharedBy.note}&rdquo;
                          </p>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert variant="info" className="rounded-xl">
                    <ShieldCheck className="w-4 h-4" />
                    <AlertTitle className="text-sm font-bold">
                      Promo Code Terms &amp; Security
                    </AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed">
                      Each code is validated against your account and valid for creative services
                      at Humantek Creator Credit Studio. Credits do not expire once credited to
                      your account.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
                  {/* TAB 2: SHARE / GIFT CREDITS GENERATOR */}
                  <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
                    <CardHeader className="p-4 sm:p-6 pb-2.5 sm:pb-3">
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <Send className="w-4 h-4 text-brand-text dark:text-amber-400" /> Generate
                        Promo Code to Share Credits
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                        Convert credits from your Studio Wallet into a 1-time promo code locked to
                        your friend or collaborator’s email address.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-6 pt-2">
                      <form onSubmit={handleGenerateGift} className="space-y-4">
                        <Field>
                          <FieldLabel className="text-xs sm:text-sm font-bold text-foreground">
                            Recipient Email Address
                          </FieldLabel>
                          <FieldDescription className="text-xs">
                            Only this email account will be able to redeem the generated promo
                            code.
                          </FieldDescription>
                          <div className="pt-1.5 relative">
                            <Mail className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <Input
                              type="email"
                              required
                              placeholder="friend@example.com"
                              value={recipientEmail}
                              onChange={(e) => setRecipientEmail(e.target.value)}
                              className="h-10 pl-8.5 text-xs sm:text-sm rounded-lg border-border/80 focus-visible:border-amber-400 focus-visible:ring-amber-400/25"
                            />
                          </div>
                        </Field>

                        <Field>
                          <div className="flex items-center justify-between gap-2">
                            <FieldLabel className="text-xs sm:text-sm font-bold text-foreground">
                              Credits to Share (CR)
                            </FieldLabel>
                            <span className="text-2xs text-muted-foreground font-mono">
                              Available: <b className="text-foreground">{walletBalance} CR</b>
                            </span>
                          </div>
                          <div className="pt-1.5 flex flex-col sm:flex-row gap-2.5">
                            <Input
                              type="number"
                              min={1}
                              max={Math.max(1, walletBalance)}
                              required
                              value={creditsInput}
                              onChange={(e) => setCreditsInput(e.target.value)}
                              className="h-10 text-xs sm:text-sm font-mono font-bold rounded-lg border-border/80 focus-visible:border-amber-400 focus-visible:ring-amber-400/25 sm:w-40"
                            />
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {QUICK_CREDIT_PRESETS.map((preset) => {
                                const isSelected = parsedCreditsToShare === preset;
                                const isDisabled = preset > walletBalance;
                                return (
                                  <Button
                                    key={preset}
                                    type="button"
                                    variant={isSelected ? 'gold' : 'outline'}
                                    size="xs"
                                    disabled={isDisabled}
                                    onClick={() => setCreditsInput(String(preset))}
                                    className="h-8 px-2.5 font-mono text-2xs font-bold rounded-lg cursor-pointer"
                                  >
                                    {preset} CR
                                  </Button>
                                );
                              })}
                              {walletBalance > 0 && (
                                <Button
                                  type="button"
                                  variant={
                                    parsedCreditsToShare === walletBalance ? 'gold' : 'outline'
                                  }
                                  size="xs"
                                  onClick={() => setCreditsInput(String(walletBalance))}
                                  className="h-8 px-2.5 font-mono text-2xs font-bold rounded-lg cursor-pointer"
                                >
                                  Max ({walletBalance} CR)
                                </Button>
                              )}
                            </div>
                          </div>
                        </Field>

                        <Field>
                          <FieldLabel className="text-xs sm:text-sm font-bold text-foreground">
                            Personal Note{' '}
                            <span className="text-muted-foreground font-normal">(Optional)</span>
                          </FieldLabel>
                          <div className="pt-1.5">
                            <Input
                              type="text"
                              maxLength={160}
                              placeholder="e.g. Here are some credits for your stream overlay!"
                              value={giftNote}
                              onChange={(e) => setGiftNote(e.target.value)}
                              className="h-9 text-xs rounded-lg border-border/80"
                            />
                          </div>
                        </Field>

                        <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
                          <div className="text-2xs text-muted-foreground">
                            {parsedCreditsToShare > 0 && parsedCreditsToShare <= walletBalance ? (
                              <span>
                                Remaining balance after generating:{' '}
                                <b className="font-mono text-foreground">
                                  {walletBalance - parsedCreditsToShare} CR
                                </b>
                              </span>
                            ) : walletBalance === 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Your wallet has 0 CR available to share.
                              </span>
                            ) : (
                              <span>Select an amount up to {walletBalance} CR.</span>
                            )}
                          </div>

                          <Button
                            type="submit"
                            variant="gold"
                            loading={isGenerating}
                            loadingText="Generating Code…"
                            disabled={
                              !recipientEmail.trim() ||
                              parsedCreditsToShare < 1 ||
                              parsedCreditsToShare > walletBalance
                            }
                            className="h-10 px-5 text-xs sm:text-sm font-bold gap-1.5 cursor-pointer shrink-0 justify-center"
                          >
                            <Ticket className="size-4" />
                            <span>
                              Generate {parsedCreditsToShare > 0 ? `${parsedCreditsToShare} CR ` : ''}
                              Promo Code
                            </span>
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Newly Generated Promo Code Banner */}
                  {latestGeneratedGift && (
                    <Card className="rounded-xl border-2 border-amber-400/60 bg-amber-400/[0.07] shadow-xs animate-in fade-in zoom-in-95 duration-200">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="gold-solid" className="text-3xs uppercase font-bold">
                                Ready to Share
                              </Badge>
                              <span className="text-2xs text-muted-foreground">
                                Locked to <b className="text-foreground">{latestGeneratedGift.recipientEmail}</b>
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-foreground pt-1">
                              Share this promo code with your friend:
                            </h3>
                          </div>
                          <CreditValue value={latestGeneratedGift.credits} size="sm" variant="pill" />
                        </div>

                        <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-background/90 border border-amber-400/40">
                          <span className="font-mono text-base sm:text-lg font-extrabold tracking-widest text-brand-text dark:text-amber-400 select-all">
                            {latestGeneratedGift.code}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <CopyButton
                              value={latestGeneratedGift.code}
                              label="Copy promo code"
                              className="size-8 rounded-lg border border-border/80 bg-card hover:bg-secondary"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                navigator.clipboard.writeText(latestGeneratedGift.code);
                                toast.success(`Copied ${latestGeneratedGift.code} to clipboard!`);
                              }}
                              className="h-8 px-3 text-xs font-bold cursor-pointer"
                            >
                              Copy Code
                            </Button>
                          </div>
                        </div>

                        <p className="text-2xs text-muted-foreground leading-relaxed">
                          When <b>{latestGeneratedGift.recipientEmail}</b> enters this code on their{' '}
                          <b>Redeem Promo Code</b> page, they will receive{' '}
                          <b className="font-mono">+{latestGeneratedGift.credits} CR</b> and both you
                          and the Studio Owner will be notified automatically.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* History of Sent Gift Promo Codes */}
                  <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
                    <CardHeader className="p-4 sm:p-5 pb-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-bold text-foreground">
                            Your Shared Promo Codes
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">
                            Track promo codes you generated from your wallet and see when they are
                            claimed.
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-2xs font-mono">
                          {sentGifts.length} {sentGifts.length === 1 ? 'code' : 'codes'}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-2">
                      {giftsQuery.isPending ? (
                        <div className="space-y-2">
                          <Skeleton className="h-14 w-full rounded-lg" />
                          <Skeleton className="h-14 w-full rounded-lg" />
                        </div>
                      ) : sentGifts.length === 0 ? (
                        <Empty className="py-8 border border-dashed border-border/70 rounded-xl">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Ticket className="size-4 text-muted-foreground" />
                            </EmptyMedia>
                            <EmptyTitle className="text-xs font-bold">
                              No shared promo codes yet
                            </EmptyTitle>
                            <EmptyDescription className="text-2xs">
                              Codes you generate for friends or collaborators will appear here with
                              their live redemption status.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      ) : (
                        <div className="space-y-2">
                          {sentGifts.map((item) => {
                            const isClaimed = item.status === 'claimed';
                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  'flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg border transition-colors',
                                  isClaimed
                                    ? 'border-emerald-500/25 bg-emerald-500/[0.03]'
                                    : 'border-border/80 bg-secondary/20'
                                )}
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold tracking-wider text-foreground select-all">
                                      {item.code}
                                    </span>
                                    <CopyButton
                                      value={item.code}
                                      label="Copy code"
                                      className="size-6"
                                    />
                                    <span className="inline-flex items-center font-mono text-2xs font-bold text-brand-text dark:text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/25">
                                      {item.credits} CR
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-2xs text-muted-foreground flex-wrap">
                                    <span>
                                      To: <b className="text-foreground/90">{item.recipientEmail}</b>
                                    </span>
                                    <span>·</span>
                                    <span>Created {formatStudioDate(item.createdAt)}</span>
                                  </div>
                                  {item.note && (
                                    <p className="text-2xs italic text-muted-foreground truncate">
                                      &ldquo;{item.note}&rdquo;
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {isClaimed ? (
                                    <Badge
                                      variant="outline"
                                      className="text-2xs font-semibold border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 gap-1"
                                    >
                                      <Check className="size-3" />
                                      <span>
                                        Claimed
                                        {item.claimedAt
                                          ? ` · ${formatStudioDate(item.claimedAt)}`
                                          : ''}
                                      </span>
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-2xs font-semibold border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1"
                                    >
                                      <Clock className="size-3" />
                                      <span>Unclaimed · Ready</span>
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* ================================================================= */}
            {/* RIGHT COLUMN: STUDIO WALLET SUMMARY & QUICK SWITCHER              */}
            {/* ================================================================= */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="p-4 sm:p-6 rounded-xl border border-border/80 bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-400/20 text-brand-text dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Studio Credit Balance</h4>
                      <p className="text-xs text-muted-foreground">
                        Available for projects or sharing
                      </p>
                    </div>
                  </div>
                  <CreditValue value={walletBalance} size="sm" variant="pill" />
                </div>

                <Separator />

                {activeTab === 'redeem' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Want to send some of your available credits to a friend or fellow creator?
                      Generate a personal promo voucher code from your balance.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab('share')}
                      className="w-full text-xs font-semibold h-9 rounded-xl gap-1.5 cursor-pointer hover:bg-secondary/80"
                    >
                      <Send className="size-3.5 text-brand-text dark:text-amber-400" />
                      <span>Share / Gift Credits to a Friend</span>
                    </Button>
                    <Link href="/new-project?step=1" className="block">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-semibold h-9 rounded-xl cursor-pointer"
                      >
                        Start a Project with Credits
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                      <p className="font-semibold text-foreground">How Credit Sharing Works:</p>
                      <ol className="list-decimal list-inside space-y-1 text-2xs">
                        <li>Enter your friend’s email address and choose how many credits to share.</li>
                        <li>
                          Credits are deducted from your wallet to generate a unique{' '}
                          <span className="font-mono text-foreground">HT-GIFT</span> promo code.
                        </li>
                        <li>
                          When your friend redeems the code in their panel, you and the Studio Owner
                          receive instant dashboard &amp; email notifications.
                        </li>
                      </ol>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('redeem')}
                      className="w-full text-xs font-semibold h-9 rounded-xl gap-1.5 cursor-pointer"
                    >
                      <Gift className="size-3.5" />
                      <span>Have a Promo Code? Redeem Here</span>
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </StudioCardLayout>
  );
}

export default function RedeemCodePage() {
  return (
    <Suspense
      fallback={
        <StudioCardLayout mode="standalone" backLabel="Back to Studio">
          <div className="space-y-6 py-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Skeleton className="lg:col-span-7 h-80 w-full rounded-xl" />
              <Skeleton className="lg:col-span-5 h-56 w-full rounded-xl" />
            </div>
          </div>
        </StudioCardLayout>
      }
    >
      <RedeemCodeContent />
    </Suspense>
  );
}
