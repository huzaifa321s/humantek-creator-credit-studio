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
    <nav aria-label="Progress Stepper" className={cn('relative flex items-center justify-center', className)}>
      {/* Desktop & Tablet — ReUI Stepper */}
      <Stepper
        value={currentStep}
        onValueChange={(step) => {
          const accessible = (isPackageSelected && step <= currentStep + 1) || step === 1;
          if (accessible) onSelectStep(step);
        }}
        indicators={{ completed: <Check className="size-4 stroke-[3]" /> }}
        className="hidden sm:block w-full max-w-4xl select-none"
      >
        <StepperNav className="items-center">
          {STUDIO_STEPS.map((step) => {
            const stepNum = step.number;
            const isAccessible = (isPackageSelected && stepNum <= currentStep + 1) || stepNum === 1;

            return (
              <StepperItem key={step.name} step={stepNum} disabled={!isAccessible} className="gap-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <StepperTrigger className="group gap-2 rounded-xl px-2 py-1.5 hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-45" />
                    }
                  >
                    <StepperIndicator className="size-8 border-2 border-border bg-card text-xs font-bold text-muted-foreground transition-all duration-200 group-hover:border-zinc-400 data-[state=completed]:border-amber-500 data-[state=completed]:bg-amber-500 data-[state=completed]:text-white data-[state=active]:scale-105 data-[state=active]:border-amber-500 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:ring-4 data-[state=active]:ring-amber-500/20">
                      {stepNum}
                    </StepperIndicator>
                    <StepperTitle className="whitespace-nowrap text-xs font-medium tracking-tight text-muted-foreground data-[state=active]:font-bold data-[state=active]:text-foreground data-[state=completed]:font-semibold data-[state=completed]:text-foreground/80">
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
                {stepNum < STUDIO_STEPS.length && (
                  <StepperSeparator className="mx-1 min-w-6 bg-border/80 transition-colors duration-300 group-data-[state=completed]/step:bg-amber-500" />
                )}
              </StepperItem>
            );
          })}
        </StepperNav>
      </Stepper>

      {/* Mobile Compact View (< 640px) */}
      <div className="flex sm:hidden items-center gap-2 px-3 py-1 rounded-full bg-secondary/60 border border-border/70 text-xs font-semibold">
        <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
          {currentStep}
        </div>
        <span className="text-foreground">
          Step {currentStep}/5: {STUDIO_STEPS[currentStep - 1]?.name}
        </span>
      </div>
    </nav>
  );
}
