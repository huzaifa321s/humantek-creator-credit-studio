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
  Download,
} from 'lucide-react';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditValue } from '@/components/ui/credit-value';
import { ChatGate } from '@/components/chat/ChatGate';
import { useUserStore, refreshUserSession } from '@/lib/userStore';
import { useChatStore } from '@/lib/chatStore';
import { useWizardStore } from '@/lib/wizardStore';
import { downloadProjectInvoice } from '@/lib/invoice';
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
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
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

  // Concise, beginner-friendly context copy
  let heading = 'Payment received';
  let description = 'Your project is now in production.';
  let statusBadgeText = 'In production';
  let isPendingOrManual = false;

  if (confirmationState === 'paid_credits') {
    heading = 'Project started';
    description = 'Your brief is with our team. Track progress anytime in your dashboard.';
    statusBadgeText = 'In production';
  } else if (confirmationState === 'online_completed') {
    heading = 'Payment received';
    description = 'Your payment went through and your project is in production.';
    statusBadgeText = 'In production';
  } else if (confirmationState === 'online_pending') {
    heading = 'Payment processing';
    description = 'We’ll start production as soon as your payment clears.';
    statusBadgeText = 'Payment processing';
    isPendingOrManual = true;
  } else if (confirmationState === 'manual_order') {
    heading = 'Order received';
    description = 'Your project brief is in our review queue. You can download your invoice below or message our team anytime.';
    statusBadgeText = 'Awaiting payment';
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

  const handleDownloadInvoice = async () => {
    if (isDownloadingInvoice) return;
    setIsDownloadingInvoice(true);
    try {
      await downloadProjectInvoice(project);
      toast.success(`Invoice INV-${project.projectCode} downloaded`);
    } catch (err) {
      console.error('Failed to generate invoice:', err);
      toast.error('Could not generate invoice PDF. Please try again.');
    } finally {
      setIsDownloadingInvoice(false);
    }
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
      <div className="w-full flex items-center justify-center py-3 sm:py-8 pb-16 sm:pb-12 animate-in fade-in duration-300">
        <Card className="max-w-md w-full mx-auto rounded-2xl border border-border/80 bg-card p-4 sm:p-7 space-y-4 sm:space-y-5 shadow-sm text-center overflow-hidden">
          {/* Screen reader announcement */}
          <div aria-live="polite" className="sr-only">
            {heading}. {description}
          </div>

          {/* Top Status Icon */}
          <div
            className={cn(
              'size-11 sm:size-12 rounded-full flex items-center justify-center mx-auto ring-6 sm:ring-8',
              isPendingOrManual
                ? 'bg-amber-400/15 text-brand-text dark:text-amber-400 ring-amber-400/10'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/10'
            )}
          >
            {isPendingOrManual ? (
              <Clock className="size-5 sm:size-6 stroke-[2.5]" />
            ) : (
              <Check className="size-5 sm:size-6 stroke-[2.5]" />
            )}
          </div>

          {/* Title & Concise Subtitle */}
          <div className="space-y-1">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="scroll-mt-[140px] text-xl sm:text-2xl font-extrabold tracking-tight text-foreground outline-none"
            >
              {heading}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xs sm:max-w-sm mx-auto leading-relaxed">
              {description}
            </p>
          </div>

          {/* Order Spec Snapshot Card */}
          <div className="rounded-xl border border-border/70 bg-secondary/20 p-3.5 sm:p-4 text-left text-xs divide-y divide-border/60 shadow-2xs space-y-2.5">
            {/* 1. Project Code with Copy */}
            <div className="flex items-center justify-between gap-3 pt-0 first:pt-0">
              <span className="text-muted-foreground font-medium shrink-0">Project code</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-mono font-bold text-foreground text-xs sm:text-sm tracking-wide truncate">
                  {project.projectCode}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCopyCode}
                  className="size-6 shrink-0 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                  title="Copy project code"
                  aria-label="Copy project code"
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>

            {/* 2. Package */}
            <div className="flex items-center justify-between gap-3 pt-2.5">
              <span className="text-muted-foreground font-medium shrink-0">Package</span>
              <span className="font-semibold text-foreground text-xs sm:text-sm text-right truncate">
                {project.packageName || matchedPack?.name || 'Studio Custom'}
              </span>
            </div>

            {/* 3. Credits */}
            <div className="flex items-center justify-between gap-3 pt-2.5">
              <span className="text-muted-foreground font-medium shrink-0">Credits</span>
              <div className="text-right">
                {confirmationState === 'manual_order' ? (
                  <CreditValue
                    value={resolvedPackageCredits || project.usedCredits}
                    size="xs"
                  />
                ) : project.fundingSource === 'wallet' ? (
                  <CreditValue
                    value={project.usedCredits}
                    size="xs"
                    suffix="CR used"
                  />
                ) : (
                  <CreditValue
                    value={`${project.usedCredits} / ${resolvedPackageCredits || project.usedCredits}`}
                    size="xs"
                    suffix="CR"
                  />
                )}
              </div>
            </div>

            {/* 4. Services Count */}
            {project.selections && project.selections.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-2.5">
                <span className="text-muted-foreground font-medium shrink-0">Services</span>
                <span className="font-semibold text-foreground text-xs sm:text-sm text-right">
                  {project.selections.length} {project.selections.length === 1 ? 'service' : 'services'} ({totalQuantity} {totalQuantity === 1 ? 'item' : 'items'})
                </span>
              </div>
            )}

            {/* 5. Status */}
            <div className="flex items-center justify-between gap-3 pt-2.5">
              <span className="text-muted-foreground font-medium shrink-0">Status</span>
              <span className="inline-flex items-center justify-end gap-1.5 font-medium text-xs sm:text-sm text-foreground text-right">
                <span
                  className={cn(
                    'size-2 rounded-full shrink-0',
                    isPendingOrManual ? 'bg-amber-400' : 'bg-emerald-500'
                  )}
                />
                <span className="truncate">{statusBadgeText}</span>
              </span>
            </div>

            {/* 6. Total Due / Total Paid Row */}
            {project.fundingSource !== 'wallet' && (
              <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-border/80">
                <span className="text-foreground font-bold text-xs sm:text-sm shrink-0">
                  {confirmationState === 'manual_order' ? 'Amount due' : 'Total paid'}
                </span>
                <span className="font-mono font-bold text-foreground text-sm sm:text-base text-right">
                  ${project.packagePrice.toLocaleString('en-US')} USD
                </span>
              </div>
            )}
          </div>

          {/* Actions: Primary View Button, Download Invoice & Responsive Secondary Actions */}
          <div className="space-y-2.5 pt-0.5 w-full">
            <Link href="/projects" className="block w-full">
              <Button
                type="button"
                variant="default"
                size="lg"
                className="w-full h-10 sm:h-11 font-bold text-sm bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground rounded-xl shadow-xs shadow-amber-400/20 cursor-pointer transition-colors"
              >
                <span>View my project</span>
                <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={isDownloadingInvoice}
              loadingText="Generating invoice..."
              onClick={handleDownloadInvoice}
              className="w-full h-9 sm:h-10 text-xs font-bold text-foreground gap-1.5 rounded-xl cursor-pointer border-border/80 hover:bg-secondary/60"
            >
              <Download className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
              <span>Download Invoice (PDF)</span>
            </Button>

            <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:items-center sm:justify-center gap-2 w-full">
              <ChatGate>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-chat-entry="confirmation-chat"
                  onClick={() => useChatStore.getState().setIsOpen(true, project.id)}
                  className="w-full sm:w-auto text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 h-9 sm:h-8 rounded-lg cursor-pointer border-border/70 hover:bg-secondary/60"
                >
                  <MessageSquare className="size-3.5 shrink-0" />
                  <span className="truncate">Message our team</span>
                </Button>
              </ChatGate>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleStartAnother}
                className="w-full sm:w-auto text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 h-9 sm:h-8 rounded-lg cursor-pointer"
              >
                <Plus className="size-3.5 shrink-0" />
                <span className="truncate">Start another project</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </StudioCardLayout>
  );
}
