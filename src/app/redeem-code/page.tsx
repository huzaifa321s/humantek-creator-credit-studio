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
import { TypographyH1 } from '@/components/ui/typography';
import { Separator } from '@/components/ui/separator';
import { CreditValue } from '@/components/ui/credit-value';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Field,
  FieldLabel,
  FieldDescription,
} from '@/components/ui/field';
import { toast } from 'sonner';
import {
  Check,
  ShieldCheck,
  Gift,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';

import { useUserStore } from '@/lib/userStore';
import { useWalletQuery, useRedeemPromoCode } from '@/lib/queries/wallet';
import { useNotificationStore } from '@/lib/notificationStore';

export default function RedeemCodePage() {
  const { user } = useUserStore();
  const walletQuery = useWalletQuery(user?.email);
  const redeemMutation = useRedeemPromoCode();

  // Redemption State
  const [redeemCode, setRedeemCode] = useState('');
  const isRedeeming = redeemMutation.isPending;
  const [redeemedAmount, setRedeemedAmount] = useState<number | null>(null);

  const walletBalance = walletQuery.data?.walletBalance ?? user?.walletBalance ?? 0;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = (redeemCode || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
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
      topRightBadge={<StudioNewProjectButton />}
    >
      <div className="space-y-6 animate-in fade-in duration-200 pb-24 sm:pb-12">
        {/* Step Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              CREATOR WALLET &amp; PASSES
            </div>
            <TypographyH1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Redeem Promo Code
            </TypographyH1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Apply a promotional code or sponsorship grant directly to your studio wallet balance.
            </p>
          </div>
        </div>

        <div className="pt-1 sm:pt-2 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start">
            <div className="lg:col-span-7 space-y-4">
              <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
                <CardHeader className="p-4 sm:p-6 pb-2.5 sm:pb-3">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Gift className="w-4 h-4 text-brand-text dark:text-amber-400" /> Claim Creator Credits
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Enter the promotional pass code received from your sponsorship manager, event, or studio grant.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 sm:p-6 pt-2">
                  <form onSubmit={handleRedeem} className="space-y-4 sm:space-y-5">
                    <Field>
                      <FieldLabel className="text-sm font-bold text-foreground">
                        Promotional Pass Code
                      </FieldLabel>
                      <FieldDescription className="text-xs">
                        Type or paste your code (e.g. <span className="font-mono font-semibold text-foreground/80">HT-150CR-ABCD</span> or <span className="font-mono font-semibold text-foreground/80">WELCOME100</span>).
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
                  Each code is validated against your account and valid for creative services at Humantek Creator Credit Studio. Credits do not expire once credited to your account.
                </AlertDescription>
              </Alert>
            </div>

            {/* Sidebar Wallet Summary Card */}
            <div className="lg:col-span-5">
              <Card className="p-4 sm:p-6 rounded-xl border border-border/80 bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-400/20 text-brand-text dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Studio Credit Balance</h4>
                      <p className="text-xs text-muted-foreground">Available for any package or service</p>
                    </div>
                  </div>
                  <CreditValue value={walletBalance} size="sm" variant="pill" />
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your redeemed credits are immediately available in the project builder to fund custom deliverables or full packages.
                </p>
                <Link href="/new-project?step=1" className="block">
                  <Button variant="outline" size="sm" className="w-full text-xs font-semibold h-9 rounded-xl cursor-pointer">
                    Start a Project with Credits
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </StudioCardLayout>
  );
}
