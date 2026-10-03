'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

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
      {/* Desktop & Tablet Stepper */}
      <ol className="hidden sm:flex items-center gap-1.5 md:gap-2.5 lg:gap-3 select-none">
        {STUDIO_STEPS.map((step, idx) => {
          const stepNum = step.number;
          const isActive = currentStep === stepNum;
          const isComplete = currentStep > stepNum;
          const isAccessible = (isPackageSelected && stepNum <= currentStep + 1) || stepNum === 1;
          const isLast = idx === STUDIO_STEPS.length - 1;

          return (
            <React.Fragment key={step.name}>
              <li className="relative flex items-center">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        disabled={!isAccessible}
                        onClick={() => isAccessible && onSelectStep(stepNum)}
                        className={cn(
                          'group flex items-center gap-2 py-1.5 px-2 rounded-xl transition-all focus:outline-none select-none',
                          isAccessible ? 'cursor-pointer hover:bg-secondary/70' : 'cursor-not-allowed opacity-45'
                        )}
                      >
                        {/* Step Circle Node */}
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-200 border-2',
                            isComplete
                              ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                              : isActive
                              ? 'bg-amber-500 border-amber-500 text-white font-extrabold shadow-sm ring-4 ring-amber-500/20 scale-105'
                              : 'bg-card border-border text-muted-foreground group-hover:border-zinc-400'
                          )}
                        >
                          {isComplete ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <span>{stepNum}</span>
                          )}
                        </div>

                        {/* Step Label */}
                        <div className="hidden sm:block text-left">
                          <div
                            className={cn(
                              'text-xs tracking-tight transition-colors whitespace-nowrap',
                              isActive
                                ? 'font-bold text-foreground'
                                : isComplete
                                ? 'font-semibold text-foreground/80'
                                : 'font-medium text-muted-foreground'
                            )}
                          >
                            <span className="hidden md:inline">{step.name}</span>
                            <span className="inline md:hidden">{step.shortName}</span>
                          </div>
                        </div>
                      </button>
                    }
                  />
                  <TooltipContent side="bottom" className="text-xs max-w-xs p-3 shadow-xl bg-zinc-900 text-white border border-zinc-700/80">
                    <p className="font-bold text-white text-xs">
                      Step {stepNum}: {step.name}
                    </p>
                    <p className="text-zinc-300 text-[11px] mt-1 leading-snug">
                      {step.desc}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </li>

              {/* Connecting Horizontal Line */}
              {!isLast && (
                <li aria-hidden="true" className="flex items-center">
                  <div
                    className={cn(
                      'h-0.5 w-6 sm:w-10 md:w-14 lg:w-20 rounded-full transition-colors duration-300',
                      isComplete ? 'bg-amber-500' : 'bg-border/80'
                    )}
                  />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>

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
