'use client';

import React from 'react';
import { Check } from 'lucide-react';
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

export interface StepItem {
  number: number;
  name: string;
  shortName: string;
  desc: string;
}

export const STUDIO_STEPS: StepItem[] = [
  {
    number: 1,
    name: 'Package',
    shortName: 'Package',
    desc: 'Select credit tier and bonus multipliers',
  },
  {
    number: 2,
    name: 'Services',
    shortName: 'Services',
    desc: 'Pick 39 creative services and scope tiers',
  },
  {
    number: 3,
    name: 'Credit Scope',
    shortName: 'Scope',
    desc: 'Acknowledge revisions, scope rules & eligibility',
  },
  {
    number: 4,
    name: 'Project Details',
    shortName: 'Details',
    desc: 'Provide instructions, links & reference files',
  },
  {
    number: 5,
    name: 'Review & Pay',
    shortName: 'Review',
    desc: 'Final review and verified PayPal checkout',
  },
];

interface HorizontalStepperProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  isPackageSelected: boolean;
  className?: string;
}

export function HorizontalStepper({
  currentStep,
  onSelectStep,
  isPackageSelected,
  className,
}: HorizontalStepperProps) {
  return (
    <nav aria-label="Progress Stepper" className={cn('relative flex items-center justify-center w-full', className)}>
      {/* Desktop & Tablet View (>= 640px) — Polished ReUI Stepper */}
      <Stepper
        value={currentStep}
        onValueChange={(step) => {
          const accessible = (isPackageSelected && step <= currentStep + 1) || step === 1;
          if (accessible) onSelectStep(step);
        }}
        indicators={{ completed: <Check className="size-4 stroke-[3]" /> }}
        className="hidden sm:block w-full max-w-4xl select-none"
      >
        <StepperNav className="items-center justify-between w-full">
          {STUDIO_STEPS.map((step) => {
            const stepNum = step.number;
            const isAccessible = (isPackageSelected && stepNum <= currentStep + 1) || stepNum === 1;

            return (
              <StepperItem key={step.name} step={stepNum} disabled={!isAccessible} className="gap-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <StepperTrigger className="group gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-secondary/70 transition-colors disabled:cursor-not-allowed disabled:opacity-40" />
                    }
                  >
                    <StepperIndicator
                      className={cn(
                        'size-8 rounded-full border-2 text-xs font-bold transition-all duration-200 shrink-0',
                        // Inactive step
                        'border-border/90 bg-muted/40 text-muted-foreground/80 group-hover:border-amber-400/60 group-hover:text-foreground',
                        // Completed step: crisp amber with white checkmark
                        'data-[state=completed]:border-amber-500 data-[state=completed]:bg-amber-500 data-[state=completed]:text-white data-[state=completed]:shadow-xs data-[state=completed]:shadow-amber-500/20',
                        // Active step: slightly larger size, rich gradient, elevated shadow & vibrant amber ring
                        'data-[state=active]:size-9 data-[state=active]:scale-105 data-[state=active]:border-amber-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/30 data-[state=active]:ring-4 data-[state=active]:ring-amber-500/25'
                      )}
                    >
                      {stepNum}
                    </StepperIndicator>

                    <StepperTitle className="whitespace-nowrap text-xs font-medium tracking-tight text-muted-foreground/80 group-hover:text-foreground transition-colors duration-200 data-[state=completed]:font-semibold data-[state=completed]:text-foreground/90 data-[state=active]:font-extrabold data-[state=active]:text-foreground">
                      <span className="hidden md:inline">{step.name}</span>
                      <span className="inline md:hidden">{step.shortName}</span>
                    </StepperTitle>
                  </TooltipTrigger>

                  <TooltipContent side="bottom" className="text-xs max-w-xs p-3 shadow-xl bg-zinc-900 text-white border border-zinc-700/80">
                    <p className="font-bold text-white text-xs">
                      Step {stepNum}: {step.name}
                    </p>
                    <p className="text-zinc-300 text-[11px] mt-1 leading-snug">{step.desc}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Substantial, high-contrast connecting line (3px height with rounded caps) */}
                {stepNum < STUDIO_STEPS.length && (
                  <StepperSeparator className="mx-2 min-w-8 sm:min-w-10 h-[3px] rounded-full bg-border transition-colors duration-300 group-data-[state=completed]/step:bg-amber-500 group-data-[state=completed]/step:shadow-xs group-data-[state=completed]/step:shadow-amber-500/20" />
                )}
              </StepperItem>
            );
          })}
        </StepperNav>
      </Stepper>

      {/* Mobile Streamlined View (< 640px) */}
      <div className="flex sm:hidden flex-col items-center justify-center w-full max-w-xs mx-auto gap-2 py-0.5 select-none">
        <div className="flex items-center justify-between w-full px-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center size-5 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[10px] font-black shadow-xs shadow-amber-500/30">
              {currentStep}
            </span>
            <span className="text-xs font-bold text-foreground">
              {STUDIO_STEPS[currentStep - 1]?.name}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            Step {currentStep} of 5
          </span>
        </div>

        {/* 5-segment micro progress track */}
        <div className="grid grid-cols-5 gap-1.5 w-full">
          {STUDIO_STEPS.map((s) => {
            const isDone = s.number < currentStep;
            const isCurr = s.number === currentStep;
            const accessible = (isPackageSelected && s.number <= currentStep + 1) || s.number === 1;

            return (
              <button
                key={s.number}
                type="button"
                disabled={!accessible}
                onClick={() => accessible && onSelectStep(s.number)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  isDone
                    ? 'bg-amber-500 shadow-2xs'
                    : isCurr
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 ring-2 ring-amber-500/25 shadow-xs'
                    : 'bg-border dark:bg-border/80'
                )}
                aria-label={`Go to Step ${s.number}: ${s.name}`}
              />
            );
          })}
        </div>
      </div>
    </nav>
  );
}
