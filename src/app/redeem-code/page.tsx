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
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Copy, Check, Ticket, Sparkles, ShieldCheck } from 'lucide-react';

export default function RedeemCodePage() {
  const [credits, setCredits] = useState(150);
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

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
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              PROMOTIONAL TOOLKIT
            </div>
            <h1 className="scroll-m-20 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground lg:text-4xl">
              Create a Credit Voucher Code
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Generate authorized single-use promotional passes for creators, team members, and partner channels.
            </p>
          </div>
        </div>

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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-foreground">Credit Amount (CR)</Label>
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
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">
                      Recipient or Channel (Optional)
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. Creator Twitch Partner"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="rounded-xl text-sm h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">Internal Campaign Note</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Q4 Sponsorship Grant"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="rounded-xl text-sm h-10"
                    />
                  </div>

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
                Generated codes can be applied once during the studio brief checkout step. Credits are non-refundable and tied to client project ID.
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
      </div>
    </StudioCardLayout>
  );
}
