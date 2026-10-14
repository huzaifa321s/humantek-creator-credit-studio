'use client';

import React from 'react';
import {
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScopeGuideModal } from '@/components/ScopeGuideModal';
import { cn } from '@/lib/utils';

interface Step1ScopeBannerProps {
  type: 'step1-scope';
  className?: string;
}

interface Step3CoverageBannerProps {
  type: 'step3-coverage';
  className?: string;
}

type StudioNoticeBannerProps =
  | Step1ScopeBannerProps
  | Step3CoverageBannerProps;

export function StudioNoticeBanner(props: StudioNoticeBannerProps) {
  if (props.type === 'step1-scope') {
    return (
      <Alert
        variant="warning"
        className={cn(
          'relative rounded-xl border border-amber-400/30 bg-amber-400/5 dark:bg-amber-950/20 px-3 sm:px-4 py-2 sm:py-2.5 shadow-2xs transition-all',
          props.className
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 w-full">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="flex size-5 sm:size-6 items-center justify-center rounded-md bg-amber-400/15 text-brand-text dark:text-amber-400 shrink-0">
              <Sparkles className="size-3 sm:size-3.5" />
            </span>
            <p className="text-xs text-foreground/90 font-medium leading-tight sm:leading-normal">
              <span className="hidden sm:inline">
                <strong className="font-semibold text-foreground">Creator Credits:</strong> Plan approved Humantek Art creative services with scope-based credits, package balances, revisions, and project tracking.
              </span>
              <span className="sm:hidden text-2xs">
                <strong className="font-semibold text-foreground">Creator Credits:</strong> Scope-based credits, package balances, revisions &amp; tracking.
              </span>
            </p>
          </div>

          <div className="shrink-0 self-end sm:self-auto">
            <ScopeGuideModal />
          </div>
        </div>
      </Alert>
    );
  }

  // Step 3 Coverage Banner
  return (
    <Alert
      variant="warning"
      className={cn(
        'relative rounded-xl border border-amber-400/30 bg-amber-400/5 dark:bg-amber-950/20 px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-2xs transition-all',
        props.className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-brand-text dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <AlertTitle className="text-xs sm:text-sm font-bold text-foreground">
                Controlled Credit Wallet
              </AlertTitle>
            </div>
            <AlertDescription className="text-xs text-muted-foreground leading-normal">
              Credits are deducted only after the team approves the service, content, and final scope.
            </AlertDescription>
          </div>
        </div>

        <div className="shrink-0 self-start lg:self-center">
          <ScopeGuideModal />
        </div>
      </div>
    </Alert>
  );
}
