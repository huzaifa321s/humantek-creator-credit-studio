'use client';

import React from 'react';
import {
  Sparkles,
  PackageCheck,
  ShieldCheck,
  Check,
  Coins,
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription, AlertAction } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScopeGuideModal } from '@/components/ScopeGuideModal';
import { cn } from '@/lib/utils';

interface Step1ScopeBannerProps {
  type: 'step1-scope';
  className?: string;
}

interface Step2ActivePackageBannerProps {
  type: 'step2-package';
  packageName: string;
  totalCredits: number;
  usedCredits: number;
  selectedCount: number;
  extrasCount: number;
  className?: string;
}

interface Step3CoverageBannerProps {
  type: 'step3-coverage';
  className?: string;
}

type StudioNoticeBannerProps =
  | Step1ScopeBannerProps
  | Step2ActivePackageBannerProps
  | Step3CoverageBannerProps;

export function StudioNoticeBanner(props: StudioNoticeBannerProps) {
  if (props.type === 'step1-scope') {
    return (
      <Alert
        variant="warning"
        className={cn(
          'relative rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 px-4 py-2.5 shadow-2xs transition-all',
          props.className
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              <Sparkles className="size-3.5" />
            </span>
            <p className="text-xs text-foreground/90 font-medium">
              <strong className="font-semibold text-foreground">Customized Creator Services:</strong> Prepaid credits for custom graphics, VTubers & stream branding · Commercial rights & revisions included.
            </p>
          </div>

          <div className="shrink-0 self-end sm:self-auto">
            <ScopeGuideModal />
          </div>
        </div>
      </Alert>
    );
  }

  if (props.type === 'step2-package') {
    const { packageName, totalCredits, usedCredits, selectedCount, extrasCount } = props;
    const progressPercent = totalCredits > 0 ? Math.min(100, Math.round((usedCredits / totalCredits) * 100)) : 0;
    const remainingCredits = Math.max(0, totalCredits - usedCredits);

    return (
      <Alert
        variant="warning"
        className={cn(
          'relative rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-4 sm:p-5 shadow-2xs space-y-3 transition-all',
          props.className
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 w-full">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTitle className="text-sm font-bold text-foreground">
                  {packageName} Plan Active
                </AlertTitle>
                <Badge variant="gold" className="text-[10px] py-0 px-2 font-bold uppercase tracking-wider">
                  {totalCredits} CR Budget
                </Badge>
              </div>
              <AlertDescription className="text-xs text-muted-foreground">
                Basic, Standard, and Elite tier options available — governed by your package limits and credit allocation.
              </AlertDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:self-center flex-wrap">
            <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
              {selectedCount} {selectedCount === 1 ? 'service' : 'services'} selected
            </Badge>
            {extrasCount > 0 && (
              <Badge variant="gold" className="text-xs font-semibold px-2.5 py-1">
                +{extrasCount} {extrasCount === 1 ? 'extra' : 'extras'}
              </Badge>
            )}
          </div>
        </div>

        {/* Dynamic Budget Progress Bar */}
        <div className="pt-2 border-t border-amber-500/20 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <div className="flex items-center gap-1.5 text-foreground">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Allocated: <b className="text-amber-700 dark:text-amber-400 font-bold">{usedCredits} CR</b> of {totalCredits} CR</span>
            </div>
            <span>{remainingCredits} CR remaining ({progressPercent}%)</span>
          </div>
          <Progress
            value={progressPercent}
            className="h-1.5 rounded-full bg-amber-500/15 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-amber-500 [&_[data-slot=progress-indicator]]:to-amber-600"
          />
        </div>
      </Alert>
    );
  }

  // Step 3 Coverage Banner
  return (
    <Alert
      variant="warning"
      className={cn(
        'relative rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-4 sm:p-5 shadow-2xs transition-all',
        props.className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 w-full">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTitle className="text-sm font-bold text-foreground">
                Clear Scopes, Fast Delivery
              </AlertTitle>
              <Badge variant="gold" className="text-[10px] py-0 px-2 font-bold uppercase tracking-wider">
                3–7 Day SLA
              </Badge>
            </div>
            <AlertDescription className="text-xs text-muted-foreground leading-normal">
              Transparent production scopes protect design quality and honor our 3–7 business day turnaround guarantee.
            </AlertDescription>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5 text-xs text-foreground font-medium">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>2–3 revision rounds included</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Stream-ready PNG, WebM & master files</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>12-month credit validity & rollover</span>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 self-start lg:self-center">
          <ScopeGuideModal />
        </div>
      </div>
    </Alert>
  );
}
