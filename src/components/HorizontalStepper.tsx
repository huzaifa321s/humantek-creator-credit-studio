'use client';

import React from 'react';
import { Check, Sparkles } from 'lucide-react';
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
  stepText: string;
  name: string;
  shortName: string;
  headline: string;
  desc: string;
}

export const STUDIO_STEPS: StepItem[] = [
  {
    number: 1,
    stepText: '1 of 5',
    name: 'Choose a package',
    shortName: 'Package',
    headline: 'Start with the right credit wallet.',
    desc: "Pick a package to get your credits. You'll see your balance update as you build your project.",
  },
  {
    number: 2,
    stepText: '2 of 5',
    name: 'Pick your services',
    shortName: 'Services',
    headline: 'Choose everything you need in one go.',
    desc: 'Select the services, set the size and quantity, and watch your credits update instantly.',
  },
  {
    number: 3,
    stepText: '3 of 5',
    name: 'What credits cover',
    shortName: 'Credits cover',
    headline: 'Check what your credits can be used for.',
    desc: 'Credits work for approved Humantek Art services only, so please check this before you continue.',
  },
  {
    number: 4,
    stepText: '4 of 5',
    name: 'Your project details',
    shortName: 'Project details',
    headline: 'Tell us what each item should include.',
    desc: 'Add your brief, reference images, and any extras, then confirm the terms.',
  },
  {
    number: 5,
    stepText: '5 of 5',
    name: 'Review & pay',
    shortName: 'Review & pay',
    headline: 'Ready to submit?',
    desc: 'Check your package, services, brief, and balance, then pay securely with PayPal.',
  },
];

interface HorizontalStepperProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  isPackageSelected: boolean;
  selectedPackageName?: string;
  selectedPackagePrice?: number;
  selectedPackageCredits?: number;
  selectedServicesCount?: number;
  usedCredits?: number;
  remainingCredits?: number;
  isPolicyAccepted?: boolean;
  isBriefCompleted?: boolean;
  className?: string;
}

export function HorizontalStepper({
  currentStep,
  onSelectStep,
  isPackageSelected,
  selectedPackageName,
  selectedPackagePrice,
  selectedPackageCredits,
  selectedServicesCount = 0,
  usedCredits = 0,
  remainingCredits = 0,
  isPolicyAccepted = false,
  isBriefCompleted = false,
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
                      <StepperTrigger className="group gap-1.5 sm:gap-2 md:gap-2.5 rounded-xl px-1.5 sm:px-2 md:px-2.5 py-1 sm:py-1.5 hover:bg-secondary/70 transition-colors disabled:cursor-not-allowed" />
                    }
                  >
                    <StepperIndicator
                      className={cn(
                        'size-7.5 sm:size-8 rounded-full border-2 text-xs font-mono font-bold tabular-nums transition-all duration-200 shrink-0',
                        // Inactive / Upcoming step: crisp and legible
                        'border-border/90 bg-card text-foreground/80 font-bold group-hover:border-amber-400/60 group-hover:text-foreground',
                        // Completed step: clean emerald green with white checkmark
                        'data-[state=completed]:border-emerald-500 data-[state=completed]:bg-emerald-500 data-[state=completed]:text-white data-[state=completed]:shadow-xs data-[state=completed]:shadow-emerald-500/20',
                        // Active step: slightly larger size, rich gradient, elevated shadow & vibrant amber-400 ring
                        'data-[state=active]:size-8.5 sm:data-[state=active]:size-9 data-[state=active]:scale-105 data-[state=active]:border-amber-400 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-400 data-[state=active]:to-amber-500 data-[state=active]:text-zinc-950 data-[state=active]:font-black data-[state=active]:shadow-md data-[state=active]:shadow-amber-400/30 data-[state=active]:ring-4 data-[state=active]:ring-amber-400/25'
                      )}
                    >
                      {stepNum}
                    </StepperIndicator>

                    <StepperTitle className="whitespace-nowrap text-xs font-medium tracking-tight text-foreground/75 group-hover:text-foreground transition-colors duration-200 data-[state=completed]:font-semibold data-[state=completed]:text-foreground/90 data-[state=active]:font-extrabold data-[state=active]:text-foreground">
                      <span className="hidden xl:inline">{step.name}</span>
                      <span className="hidden md:inline xl:hidden">{step.shortName}</span>
                    </StepperTitle>
                  </TooltipTrigger>

                  <TooltipContent side="bottom" className="text-xs max-w-xs p-3 shadow-xl bg-zinc-900 text-white border border-zinc-700/80">
                    <p className="font-bold text-white text-xs">
                      {step.stepText}: {step.name}
                    </p>

                    {/* Step 1: Package Selection Context */}
                    {stepNum === 1 && isPackageSelected && selectedPackageName ? (
                      <div className="mt-1.5 pt-1.5 border-t border-zinc-700/80 space-y-0.5">
                        <p className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Selected: {selectedPackageName}</span>
                        </p>
                        <p className="text-zinc-300 text-xs font-mono tabular-nums">
                          {selectedPackageCredits ? `${selectedPackageCredits} CR` : ''}
                          {selectedPackagePrice ? ` · $${selectedPackagePrice.toLocaleString('en-US')} USD` : ''}
                        </p>
                        <p className="text-amber-400 text-2xs font-semibold pt-0.5">
                          Click step 1 to switch package
                        </p>
                      </div>
                    ) : /* Step 2: Selected Services Scope Context */
                    stepNum === 2 && selectedServicesCount > 0 ? (
                      <div className="mt-1.5 pt-1.5 border-t border-zinc-700/80 space-y-0.5">
                        <p className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>
                            {selectedServicesCount} {selectedServicesCount === 1 ? 'Service' : 'Services'} Selected
                          </span>
                        </p>
                        <p className="text-zinc-300 text-xs font-mono tabular-nums">
                          {usedCredits} CR allocated · {remainingCredits >= 0 ? `${remainingCredits} CR remaining` : `${Math.abs(remainingCredits)} CR over`}
                        </p>
                        {currentStep !== 2 && (
                          <p className="text-amber-400 text-2xs font-semibold pt-0.5">
                            Click step 2 to modify services
                          </p>
                        )}
                      </div>
                    ) : /* Step 3: Policy Acceptance Context */
                    stepNum === 3 && isPolicyAccepted ? (
                      <div className="mt-1.5 pt-1.5 border-t border-zinc-700/80 space-y-0.5">
                        <p className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Scope & Revision Policy Accepted</span>
                        </p>
                        <p className="text-zinc-300 text-xs">
                          Commercial streaming rights & revision rules confirmed
                        </p>
                        {currentStep !== 3 && (
                          <p className="text-amber-400 text-2xs font-semibold pt-0.5">
                            Click step 3 to review policy
                          </p>
                        )}
                      </div>
                    ) : /* Step 4: Creative Brief Context */
                    stepNum === 4 && isBriefCompleted ? (
                      <div className="mt-1.5 pt-1.5 border-t border-zinc-700/80 space-y-0.5">
                        <p className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Brief Completed & Terms Agreed</span>
                        </p>
                        <p className="text-zinc-300 text-xs">
                          Channel details, references & requirements locked in
                        </p>
                        {currentStep !== 4 && (
                          <p className="text-amber-400 text-2xs font-semibold pt-0.5">
                            Click step 4 to edit brief
                          </p>
                        )}
                      </div>
                    ) : /* Step 5: Checkout State Context */
                    stepNum === 5 && currentStep === 5 ? (
                      <div className="mt-1.5 pt-1.5 border-t border-zinc-700/80 space-y-0.5">
                        <p className="text-amber-400 text-xs font-bold flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Ready for Review & Payment</span>
                        </p>
                        <p className="text-zinc-300 text-xs">
                          Final scope verification & secure PayPal checkout
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-amber-400 text-xs font-semibold mt-1">
                          {step.headline}
                        </p>
                        <p className="text-zinc-300 text-xs mt-1 leading-snug">{step.desc}</p>
                      </>
                    )}
                  </TooltipContent>
                </Tooltip>

                {/* Substantial, high-contrast connecting line (3px height with rounded caps) */}
                {stepNum < STUDIO_STEPS.length && (
                  <StepperSeparator className="mx-1 sm:mx-1.5 md:mx-2 min-w-3 sm:min-w-4 md:min-w-6 lg:min-w-10 h-[3px] rounded-full bg-border transition-colors duration-300 group-data-[state=completed]/step:bg-emerald-500 group-data-[state=completed]/step:shadow-xs group-data-[state=completed]/step:shadow-emerald-500/20" />
                )}
              </StepperItem>
            );
          })}
        </StepperNav>
      </Stepper>

      {/* Mobile Streamlined View (< 640px) */}
      <div className="flex sm:hidden flex-col items-center justify-center w-full max-w-md mx-auto gap-2.5 py-0.5 select-none">
        <div className="flex items-center justify-between w-full px-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center size-5.5 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 text-xs font-black font-mono tabular-nums shadow-xs shadow-amber-400/30 shrink-0">
              {currentStep}
            </span>
            <span className="text-xs font-bold text-foreground truncate">
              {STUDIO_STEPS[currentStep - 1]?.name}
            </span>
          </div>
          <span className="text-xs font-semibold text-muted-foreground font-mono tabular-nums shrink-0 ml-2">
            {STUDIO_STEPS[currentStep - 1]?.stepText}
          </span>
        </div>

        {/* 5-segment micro progress track with accessible tap target */}
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
                className="py-1.5 -my-1.5 group flex items-center cursor-pointer disabled:cursor-not-allowed w-full outline-none"
                aria-label={`Go to Step ${s.number}: ${s.name}`}
              >
                <span
                  className={cn(
                    'h-2 w-full rounded-full transition-all duration-300 block',
                    isDone
                      ? 'bg-emerald-500 shadow-2xs'
                      : isCurr
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 ring-2 ring-amber-500/25 shadow-xs'
                      : 'bg-border dark:bg-border/80 group-hover:bg-muted-foreground/40'
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
