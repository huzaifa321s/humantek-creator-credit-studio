'use client';

import React from 'react';
import { Check, Sparkles, Clock, Loader2 } from 'lucide-react';
import { cn, formatStudioDate } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import type { ProjectRecord } from '@/types';

export interface PipelineStageInfo {
  number: number;
  id: string;
  name: string;
  shortName: string;
  description: string;
  signoff: string;
}

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    number: 1,
    id: 'request_received',
    name: 'Request Received',
    shortName: 'Request',
    description: 'Order created, client channel details validated, and initial production ticket queued.',
    signoff: 'Automated Studio Intake',
  },
  {
    number: 2,
    id: 'payment_confirmed',
    name: 'Payment Confirmed',
    shortName: 'Payment',
    description: 'Creator credits or PayPal funding verified and escrowed for media deliverable scope.',
    signoff: 'Finance & Wallet Engine',
  },
  {
    number: 3,
    id: 'brief_approved',
    name: 'Brief Approved',
    shortName: 'Brief',
    description: 'Lead Producer reviewed and locked project aesthetic, color palette, and asset deliverables.',
    signoff: 'Creative Director · Sarah Miller',
  },
  {
    number: 4,
    id: 'in_production',
    name: 'In Production',
    shortName: 'Production',
    description: 'Production team actively designing brand assets, 2D/3D illustration, and stream motion pack.',
    signoff: 'Senior Motion Artist',
  },
  {
    number: 5,
    id: 'review_round',
    name: 'Review Round',
    shortName: 'Review',
    description: 'First draft preview delivered to client for quality review, comments, and polish adjustments.',
    signoff: 'Lead Producer & Client',
  },
  {
    number: 6,
    id: 'delivered',
    name: 'Delivered',
    shortName: 'Delivered',
    description: 'Final 4K master files, layered source archives, and commercial broadcast rights released.',
    signoff: 'Humantek Production Archive',
  },
];

export function getPipelineStageIndex(status: ProjectRecord['status']): number {
  switch (status) {
    case 'pending_review':
      return 0; // Stage 1 active (Request Received)
    case 'payment_confirmed':
      return 1; // Stage 2 active (Payment Confirmed)
    case 'in_production':
      return 3; // Stage 4 active (In Production) — Stages 1, 2, 3 completed
    case 'review_round':
      return 4; // Stage 5 active (Review Round)
    case 'delivered':
      return 5; // Stage 6 active (Delivered)
    case 'declined':
      return 0;
    default:
      return 0;
  }
}

interface ProjectPipelineStepperProps {
  status: ProjectRecord['status'];
  createdAt: string;
  projectCode?: string;
  className?: string;
}

export function ProjectPipelineStepper({
  status,
  createdAt,
  className,
}: ProjectPipelineStepperProps) {
  const activeIndex = getPipelineStageIndex(status);
  const activeStep = activeIndex + 1;

  const baseDate = createdAt ? new Date(createdAt).getTime() : Date.now();
  const now = Date.now();

  // Consistent date calculator:
  // - Completed stages: realistic historical timeline from createdAt up to today
  // - Current stage: capped at today (never into the future)
  // - Future stages: null (drop 'Upcoming / In Queue' text per design requirements)
  const getStageDate = (idx: number): string | null => {
    if (idx < activeIndex) {
      const daysAgo = (activeIndex - idx) * 86400000;
      const stageTime = new Date(Math.max(baseDate, now - daysAgo));
      return formatStudioDate(stageTime);
    }
    if (idx === activeIndex) {
      return formatStudioDate(new Date(Math.max(baseDate, now)));
    }
    return null;
  };

  // Progress percentage between the first and last step centers (0% to 100%)
  const progressPercent = Math.min(100, Math.max(0, (activeIndex / 5) * 100));

  return (
    <div className={cn('w-full select-none', className)}>
      {/* ========================================================= */}
      {/* Desktop & Tablet Stepper View (>= 640px)                  */}
      {/* Equal-width 6-column grid with centered circles & labels */}
      {/* ========================================================= */}
      <div className="hidden sm:block w-full relative">
        {/* Connector Line passing between circle centers */}
        <div
          className="absolute top-4.5 -translate-y-1/2 h-[2px] bg-border/70 z-0"
          style={{
            left: 'calc(100% / 12)',
            right: 'calc(100% / 12)',
          }}
        >
          {/* Completed progress fill */}
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 6 Equal-Width Step Columns */}
        <ol className="grid grid-cols-6 gap-2 w-full relative z-10">
          {PIPELINE_STAGES.map((stage, idx) => {
            const stepNum = stage.number;
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isUpcoming = idx > activeIndex;
            const stageDate = getStageDate(idx);

            return (
              <li
                key={stage.id}
                className="flex flex-col items-center text-center px-1"
              >
                {/* Circle Indicator with Tooltip */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`${stage.name}: ${isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Upcoming'}`}
                        className={cn(
                          'size-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                          // Completed: Emerald green with white checkmark
                          isCompleted &&
                            'border-2 border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600',
                          // Current: Amber-400 with dark high-contrast animated mark
                          isCurrent &&
                            'border-2 border-amber-400 bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 ring-4 ring-amber-400/30 shadow-amber-400/30 scale-105',
                          // Upcoming: Neutral clean circle with step number
                          isUpcoming &&
                            'border-2 border-border bg-card text-muted-foreground hover:border-amber-400/50'
                        )}
                      >
                        {isCompleted ? (
                          <Check className="size-4 stroke-[3] text-white" />
                        ) : isCurrent ? (
                          <Loader2 className="size-4 animate-spin text-zinc-950 stroke-[3]" />
                        ) : (
                          <span className="text-xs font-mono font-bold tabular-nums">
                            {stepNum}
                          </span>
                        )}
                      </button>
                    }
                  />

                  {/* Contextual Detail Tooltip */}
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="dark max-w-xs p-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-3xs font-mono font-semibold uppercase tracking-wider tabular-nums text-amber-400">
                        Stage {stepNum} of 6
                      </span>
                      <span
                        className={cn(
                          'text-3xs font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider',
                          isCompleted && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                          isCurrent && 'bg-amber-400/15 text-amber-400 border border-amber-400/30',
                          isUpcoming && 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        )}
                      >
                        {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Upcoming'}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-white mb-1">
                      {stage.name}
                    </p>
                    <p className="text-2xs text-zinc-300 leading-relaxed mb-2">
                      {stage.description}
                    </p>

                    <div className="pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-3xs text-zinc-400">
                      <span>{stage.signoff}</span>
                      {stageDate && (
                        <span className="font-mono tabular-nums text-zinc-300">{stageDate}</span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Stage Label directly under circle */}
                <p
                  className={cn(
                    'mt-2 text-xs md:text-sm leading-tight transition-colors',
                    isCurrent
                      ? 'font-bold text-foreground'
                      : isCompleted
                      ? 'font-semibold text-foreground'
                      : 'font-medium text-muted-foreground'
                  )}
                >
                  <span className="hidden lg:inline">{stage.name}</span>
                  <span className="inline lg:hidden">{stage.shortName}</span>
                </p>

                {/* Status indicator / Date (only shown for completed or active) */}
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 mt-1 text-2xs font-semibold text-brand-text dark:text-amber-400 whitespace-nowrap">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                    </span>
                    In Progress
                  </span>
                ) : null}

                {stageDate ? (
                  <p className="mt-0.5 text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                    {stageDate}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* ========================================================= */}
      {/* Mobile Streamlined View (< 640px)                         */}
      {/* Vertical list with left-side connector line               */}
      {/* ========================================================= */}
      <div className="block sm:hidden w-full relative">
        <ol className="relative space-y-4 pl-1">
          {/* Vertical connector line */}
          <div
            className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-border/70 -translate-x-1/2 z-0"
          />

          {PIPELINE_STAGES.map((stage, idx) => {
            const stepNum = stage.number;
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isUpcoming = idx > activeIndex;
            const stageDate = getStageDate(idx);

            return (
              <li
                key={stage.id}
                className="relative z-10 flex items-start gap-3.5"
              >
                {/* Circle */}
                <div
                  className={cn(
                    'size-8 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs transition-colors shadow-2xs',
                    isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent && 'border-amber-400 bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 font-black ring-4 ring-amber-400/30 shadow-amber-400/25',
                    isUpcoming && 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-3.5 stroke-[3] text-white" />
                  ) : isCurrent ? (
                    <Loader2 className="size-3.5 animate-spin text-zinc-950 stroke-[3]" />
                  ) : (
                    <span className="text-2xs font-mono font-bold tabular-nums">
                      {stepNum}
                    </span>
                  )}
                </div>

                {/* Text details */}
                <div className="pt-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        'text-xs font-medium leading-tight',
                        isCurrent
                          ? 'font-bold text-foreground'
                          : isCompleted
                          ? 'font-semibold text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {stage.name}
                    </p>
                    {stageDate && (
                      <span className="text-2xs text-muted-foreground font-mono tabular-nums shrink-0">
                        {stageDate}
                      </span>
                    )}
                  </div>

                  {isCurrent && (
                    <div className="inline-flex items-center gap-1.5 mt-1 text-2xs font-semibold text-brand-text dark:text-amber-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                      </span>
                      In Progress
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
