'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock,
  Copy,
  ArrowRight,
  MessageSquare,
  Plus,
  Building2,
} from 'lucide-react';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChatGate } from '@/components/chat/ChatGate';
import { useUserStore, refreshUserSession } from '@/lib/userStore';
import { useChatStore } from '@/lib/chatStore';
import { useWizardStore } from '@/lib/wizardStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PACKAGES } from '@/lib/catalog';
import type { ProjectRecord } from '@/types';

interface ConfirmationContentProps {
  project: ProjectRecord;
  canChat?: boolean;
}

export type ConfirmationPaymentState =
  | 'paid_credits'
  | 'online_completed'
  | 'online_pending'
  | 'manual_order';

export function getConfirmationState(project: ProjectRecord): ConfirmationPaymentState {
  if (project.fundingSource === 'wallet' || project.paymentMethod === 'credits') {
    return 'paid_credits';
  }
  if (project.paymentStatus === 'paid') {
    return 'online_completed';
  }
  if (
    project.paymentStatus === 'pending' ||
    (project.status as string) === 'capture_pending'
  ) {
    return 'online_pending';
  }
  if (
    project.paymentStatus === 'unpaid' ||
    project.paymentMethod === 'manual' ||
    project.status === 'pending_review'
  ) {
    return 'manual_order';
  }
  return 'online_completed';
}

export default function ConfirmationContent({ project, canChat }: ConfirmationContentProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confettiFired = useRef(false);
  const [, setCopied] = useState(false);
  const resetWizard = useWizardStore((state) => state.resetWizard);

  const confirmationState = getConfirmationState(project);

  // Focus heading on mount for accessibility & announce via aria-live.
  useEffect(() => {
    // If server passed verified canChat from getRequestUser(), set it
    if (typeof canChat === 'boolean') {
      useUserStore.getState().updateUser({ hasProjects: true, canChat });
    } else {
      void refreshUserSession();
    }

    // Register project in chat store
    useChatStore.getState().registerProject({
      id: project.id,
      projectCode: project.projectCode,
      packageName: project.packageName,
      clientName: project.clientName,
      status: project.status,
      price: project.packagePrice,
      credits: project.packageCredits,
    });

    // Clear wizard draft now that project confirmation has successfully mounted
    resetWizard();

    // Accessible focus to heading
    headingRef.current?.focus();
  }, [project, canChat, resetWizard]);

  // Celebratory confetti trigger on mount (Strict-mode & mobile safe, dynamically imported)
  useEffect(() => {
    if (confettiFired.current) return;

    const timer = setTimeout(async () => {
      confettiFired.current = true;
      try {
        const { default: confetti } = await import('canvas-confetti');

        // Stage 1: Vibrant center burst (visible across all mobile viewports)
        confetti({
          particleCount: 110,
          spread: 75,
          origin: { x: 0.5, y: 0.4 },
          zIndex: 99999,
          colors: ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#ffffff'],
        });

        // Stage 2: Dual side-cannon follow-up wave
        setTimeout(() => {
          try {
            confetti({
              particleCount: 50,
              angle: 60,
              spread: 55,
              origin: { x: 0.1, y: 0.5 },
              zIndex: 99999,
              colors: ['#f59e0b', '#fbbf24', '#ffffff'],
            });
            confetti({
              particleCount: 50,
              angle: 120,
              spread: 55,
              origin: { x: 0.9, y: 0.5 },
              zIndex: 99999,
              colors: ['#f59e0b', '#fbbf24', '#ffffff'],
            });
          } catch {}
        }, 180);
      } catch (err) {
        console.warn('[Confirmation] Confetti failed to fire:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // Context-dependent copy
  let heading = 'Payment received';
  let description = 'Your payment went through and your project has started.';
  let statusBadgeText = 'In production';
  let nextStepText = 'Studio brief review & creative queue';
  let paymentSummary = `Paid $${project.packagePrice.toLocaleString('en-US')} USD`;
  let isPendingOrManual = false;

  if (confirmationState === 'paid_credits') {
    heading = 'Project started';
    description = 'We’ve started your project. Next, we review your brief and message you if we need anything.';
    statusBadgeText = 'In production';
    nextStepText = 'Studio brief review & creative queue';
    paymentSummary = `Funded with ${project.usedCredits} credits`;
  } else if (confirmationState === 'online_completed') {
    heading = 'Payment received';
    description = 'Your payment went through and your project has started.';
    statusBadgeText = 'In production';
    nextStepText = 'Studio brief review & creative queue';
    paymentSummary = `Paid $${project.packagePrice.toLocaleString('en-US')} USD`;
  } else if (confirmationState === 'online_pending') {
    heading = 'Payment processing';
    description = 'We’ll start as soon as the payment clears.';
    statusBadgeText = 'Payment processing';
    nextStepText = 'Awaiting payment clearance';
    paymentSummary = `Pending payment of $${project.packagePrice.toLocaleString('en-US')} USD`;
    isPendingOrManual = true;
  } else if (confirmationState === 'manual_order') {
    heading = 'Order received';
    description = 'We’ve received your brief. Our team will review it and send payment details within 1 business day.';
    statusBadgeText = 'Pending review & payment';
    nextStepText = 'Waiting for payment';
    paymentSummary = `Amount due: $${project.packagePrice.toLocaleString('en-US')} USD`;
    isPendingOrManual = true;
  }

  const matchedPack = PACKAGES.find(
    (pkg) =>
      pkg.id === project.packageId ||
      pkg.name.toLowerCase() === (project.packageName || '').toLowerCase()
  );
  const resolvedPackageCredits = project.packageCredits || matchedPack?.credits || 0;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(project.projectCode);
    setCopied(true);
    toast.success('Project code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartAnother = () => {
    resetWizard();
    router.push('/new-project?step=1');
  };

  const totalQuantity = (project.selections || []).reduce((acc, s) => acc + (s.quantity || 1), 0);

  return (
    <StudioCardLayout
      mode="wizard"
      hideStepper={true}
      showBack={false}
      topRightBadge={null}
    >
      <div className="w-full flex items-center justify-center py-6 sm:py-10 pb-24 sm:pb-14 animate-in fade-in duration-300">
        <Card className="max-w-lg w-full mx-auto rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-6 shadow-sm text-center">
          {/* Screen reader announcement */}
          <div aria-live="polite" className="sr-only">
            {heading}. {description}
          </div>

          {/* Top Status Icon */}
          <div
            className={cn(
              'size-12 rounded-full flex items-center justify-center mx-auto ring-8',
              isPendingOrManual
                ? 'bg-amber-400/15 text-brand-text dark:text-amber-400 ring-amber-400/10'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/10'
            )}
          >
            {isPendingOrManual ? (
              <Clock className="size-6 stroke-[2.5]" />
            ) : (
              <Check className="size-6 stroke-[2.5]" />
            )}
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-1.5">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground outline-none"
            >
              {heading}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {description}
            </p>
          </div>

          {/* Order Spec Snapshot Card */}
          <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 sm:p-5 text-left text-xs divide-y divide-border/60 shadow-2xs space-y-3">
            {/* 1. Project Code with Copy */}
            <div className="flex items-center justify-between pt-0 first:pt-0">
              <span className="text-muted-foreground font-medium">Project code</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-foreground text-xs sm:text-sm tracking-wide">
                  {project.projectCode}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCopyCode}
                  className="size-6 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                  title="Copy project code"
                  aria-label="Copy project code"
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>

            {/* 2. Package */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-muted-foreground font-medium">Package</span>
              <span className="font-semibold text-foreground text-xs sm:text-sm">
                {project.packageName || matchedPack?.name || 'Studio Custom'}
              </span>
            </div>

            {/* 3. Credits */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-muted-foreground font-medium">Credits</span>
              <span className="font-semibold text-foreground text-xs sm:text-sm">
                {confirmationState === 'manual_order'
                  ? `${resolvedPackageCredits || project.usedCredits} CR · added after payment is confirmed`
                  : project.fundingSource === 'wallet'
                  ? `${project.usedCredits} credits used`
                  : `${project.usedCredits} of ${resolvedPackageCredits || project.usedCredits} used`}
              </span>
            </div>

            {/* 4. Deliverables Count */}
            {project.selections && project.selections.length > 0 && (
              <div className="flex items-center justify-between pt-3">
                <span className="text-muted-foreground font-medium">Deliverables</span>
                <span className="font-semibold text-foreground text-xs sm:text-sm">
                  {project.selections.length} {project.selections.length === 1 ? 'service' : 'services'} ({totalQuantity} total items)
                </span>
              </div>
            )}

            {/* 5. Status */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-muted-foreground font-medium">Status</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-xs sm:text-sm text-foreground">
                <span
                  className={cn(
                    'size-2 rounded-full',
                    isPendingOrManual ? 'bg-amber-400' : 'bg-emerald-500'
                  )}
                />
                {statusBadgeText}
              </span>
            </div>

            {/* 6. Next step */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-muted-foreground font-medium">Next step</span>
              <span className="font-medium text-muted-foreground text-xs sm:text-sm text-right">
                {nextStepText}
              </span>
            </div>

            {/* 7. Total Due / Amount Due Row */}
            <div className="flex items-center justify-between pt-3 border-t border-border/80">
              <span className="text-foreground font-bold text-xs sm:text-sm">
                {confirmationState === 'manual_order' ? 'Amount due' : 'Total paid'}
              </span>
              <span className="font-mono font-bold text-foreground text-sm sm:text-base">
                ${project.packagePrice.toLocaleString('en-US')} USD
              </span>
            </div>
          </div>

          {/* Payment Instructions (Only for manual_order) */}
          {confirmationState === 'manual_order' && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-left space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-text dark:text-amber-400">
                <Building2 className="size-3.5" />
                <span>How payment works</span>
              </div>
              <p className="text-2xs sm:text-xs text-muted-foreground leading-relaxed">
                We’ll review your brief and send an invoice + bank/PayPal details to your email and studio chat. Always quote project code{' '}
                <strong className="font-mono font-bold text-foreground">{project.projectCode}</strong>.
              </p>
            </div>
          )}

          {/* Receipt Note for paid orders */}
          {project.email && confirmationState !== 'manual_order' && (
            <p className="text-xs text-muted-foreground leading-normal">
              Receipt sent to {project.email}
            </p>
          )}

          {/* Actions: Primary View Button & Secondary Links */}
          <div className="space-y-3 pt-1 w-full">
            <Link href="/projects" className="block w-full">
              <Button
                type="button"
                variant="default"
                size="lg"
                className="w-full h-11 font-bold text-sm bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground rounded-xl shadow-xs shadow-amber-400/20 cursor-pointer transition-colors"
              >
                <span>View my project</span>
                <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>

            <div className="flex items-center justify-center gap-3">
              <ChatGate>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-chat-entry="confirmation-chat"
                  onClick={() => useChatStore.getState().setIsOpen(true, project.id)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 h-8 rounded-lg cursor-pointer border-border/70 hover:bg-secondary/60"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Message our team</span>
                </Button>
              </ChatGate>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleStartAnother}
                className="text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 h-8 rounded-lg cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Start another project</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </StudioCardLayout>
  );
}
