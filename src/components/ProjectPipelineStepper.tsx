'use client';

import React from 'react';
import { Check, Sparkles, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/reui/stepper';
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
      return 3; // Stage 4 active (In Production)
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
  projectCode,
  className,
}: ProjectPipelineStepperProps) {
  const activeIndex = getPipelineStageIndex(status);
  const activeStep = activeIndex + 1;

  const baseDate = createdAt ? new Date(createdAt).getTime() : Date.now();

  const getStageDate = (idx: number) => {
    if (idx <= activeIndex) {
      const stageTime = new Date(baseDate + idx * 86400000);
      return stageTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return 'In Queue';
  };

  return (
    <div className={cn('w-full select-none', className)}>
      {/* ========================================================= */}
      {/* Desktop & Tablet Stepper View (>= 640px)                  */}
      {/* ========================================================= */}
      <div className="hidden sm:block w-full">
        <Stepper
          value={activeStep}
          orientation="horizontal"
          indicators={{
            completed: <Check className="size-3.5 stroke-[3] text-white" />,
          }}
          className="w-full"
        >
          <StepperNav className="items-start justify-between w-full">
            {PIPELINE_STAGES.map((stage, idx) => {
              const stepNum = stage.number;
              const isCompleted = idx < activeIndex;
              const isCurrent = idx === activeIndex;
              const isUpcoming = idx > activeIndex;
              const stageDate = getStageDate(idx);

              return (
                <StepperItem
                  key={stage.id}
                  step={stepNum}
                  className="flex-1 items-start flex-col gap-2 relative not-last:pe-3"
                >
                  {/* Top Line: Indicator + Connecting Separator */}
                  <div className="flex items-center w-full">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <StepperTrigger
                            className="group p-0 bg-transparent hover:bg-transparent rounded-full cursor-pointer transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/50"
                            aria-label={`${stage.name}: ${isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Upcoming'}`}
                          />
                        }
                      >
                        <StepperIndicator
                          className={cn(
                            'size-6.5 rounded-full border-2 text-xs font-bold transition-all duration-200 shrink-0 shadow-2xs',
                            // Completed: Emerald green badge with checkmark
                            isCompleted &&
                              'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20',
                            // In Progress: Pulsing Amber badge
                            isCurrent &&
                              'border-amber-500 bg-amber-500 text-white ring-4 ring-amber-500/25 shadow-amber-500/30 scale-105 animate-pulse',
                            // Upcoming: Clean neutral circle
                            isUpcoming &&
                              'border-border bg-card text-muted-foreground font-semibold hover:border-amber-400/50'
                          )}
                        >
                          {isCompleted ? (
                            <Check className="size-3.5 stroke-[3] text-white" />
                          ) : (
                            <span className="text-xs font-bold">{stepNum}</span>
                          )}
                        </StepperIndicator>
                      </TooltipTrigger>

                      {/* Rich Contextual Tooltip */}
                      <TooltipContent
                        side="top"
                        sideOffset={6}
                        className="dark max-w-xs p-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-3xs font-mono font-semibold uppercase tracking-wider text-amber-400">
                            Stage {stepNum} of 6
                          </span>
                          <span
                            className={cn(
                              'text-3xs font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider',
                              isCompleted && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                              isCurrent && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
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
                          <span className="font-mono text-zinc-300">{stageDate}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* Connecting line to next step */}
                    {stepNum < PIPELINE_STAGES.length && (
                      <StepperSeparator
                        className={cn(
                          'flex-1 h-[2.5px] rounded-full mx-2 transition-colors duration-300',
                          idx < activeIndex ? 'bg-amber-500 shadow-2xs' : 'bg-border/80'
                        )}
                      />
                    )}
                  </div>

                  {/* Bottom Text Details */}
                  <div className="space-y-0.5 pt-0.5 text-left">
                    <StepperTitle
                      className={cn(
                        'text-xs leading-tight transition-colors',
                        isCurrent
                          ? 'font-bold text-amber-700 dark:text-amber-400'
                          : isCompleted
                          ? 'font-semibold text-foreground'
                          : 'font-medium text-muted-foreground'
                      )}
                    >
                      {stage.name}
                    </StepperTitle>

                    {/* Stage status indicator */}
                    <div className="text-xs font-medium leading-none pt-0.5">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                          In Progress
                        </span>
                      ) : isCompleted ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                          <Check className="size-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">Upcoming</span>
                      )}
                    </div>

                    {/* Stage Timestamp */}
                    <div className="text-xs text-muted-foreground font-mono">
                      {stageDate}
                    </div>
                  </div>
                </StepperItem>
              );
            })}
          </StepperNav>
        </Stepper>
      </div>

      {/* ========================================================= */}
      {/* Mobile Streamlined View (< 640px)                         */}
      {/* ========================================================= */}
      <div className="block sm:hidden space-y-3">
        {/* Active Stage Callout Card */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold ring-2 ring-amber-500/25">
              {activeStep}
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">
                {PIPELINE_STAGES[activeIndex]?.name}
              </p>
              <p className="text-2xs text-muted-foreground font-mono">
                {getStageDate(activeIndex)} · In Progress
              </p>
            </div>
          </div>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            {activeStep} of 6
          </span>
        </div>

        {/* 6-Segment Mini Track */}
        <div className="grid grid-cols-6 gap-1 w-full">
          {PIPELINE_STAGES.map((s, idx) => (
            <div
              key={s.id}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                idx < activeIndex
                  ? 'bg-emerald-500'
                  : idx === activeIndex
                  ? 'bg-amber-500 ring-2 ring-amber-500/30'
                  : 'bg-border'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
