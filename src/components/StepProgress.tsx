'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

interface StepProgressProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  isPackageSelected: boolean;
}

const STEPS = [
  { name: 'Package', desc: 'Select credit tier and bonus multipliers' },
  { name: 'Services', desc: 'Pick 39 creative services and scope tiers' },
  { name: 'Credit Scope', desc: 'Acknowledge revisions, scope rules and eligibility' },
  { name: 'Project Details', desc: 'Provide instructions, links and reference files' },
  { name: 'Review & Pay', desc: 'Final review and verified PayPal checkout' },
];

export function StepProgress({
  currentStep,
  onSelectStep,
  isPackageSelected,
}: StepProgressProps) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <div className="relative flex items-center justify-between">
        {/* Continuous background track line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-border -z-0" />

        {/* Dynamic active progress line */}
        <div
          className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-amber-500 transition-all duration-500 ease-out -z-0"
          style={{
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
          }}
        />

        {STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const isActive = currentStep === stepNum;
          const isComplete = currentStep > stepNum;
          const isDisabled = !isPackageSelected && idx > 0;

          return (
            <Tooltip key={step.name}>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDisabled}
                    onClick={() => isPackageSelected && onSelectStep(stepNum)}
                    className={cn(
                      'h-auto p-0 group flex flex-col items-center gap-2 relative z-10 transition-all hover:bg-transparent shadow-none',
                      isDisabled && 'opacity-40 cursor-not-allowed'
                    )}
                  />
                }
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border-2',
                    isComplete
                      ? 'bg-amber-500 border-amber-500 text-white shadow-xs shadow-amber-500/20'
                      : isActive
                      ? 'bg-amber-50 text-amber-800 border-amber-500 ring-4 ring-amber-500/15 font-black scale-110 shadow-sm'
                      : 'bg-card border-border text-muted-foreground group-hover:border-zinc-300'
                  )}
                >
                  {isComplete ? <Check className="w-4 h-4 stroke-[3]" /> : stepNum}
                </div>

                <span
                  className={cn(
                    'text-xs font-semibold tracking-tight transition-colors hidden sm:block',
                    isActive
                      ? 'text-amber-700 font-bold'
                      : isComplete
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {step.name}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-sm max-w-xs p-3 shadow-xl">
                <span className="font-bold block text-white text-sm mb-1">
                  Step {stepNum}: {step.name}
                </span>
                <span className="text-zinc-300 text-xs leading-relaxed block">{step.desc}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
