'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveWizardDraft } from '@/lib/wizardStore';
import { cn } from '@/lib/utils';

export function StudioNewProjectButton({ className }: { className?: string }) {
  const { hasDraft, step } = useActiveWizardDraft();

  if (hasDraft) {
    return (
      <Link href="/new-project" className="shrink-0">
        <Button
          variant="gold"
          size="sm"
          className={cn(
            'gap-1.5 cursor-pointer relative shadow-xs shadow-amber-400/25 ring-1 ring-amber-400/50 whitespace-nowrap',
            className
          )}
          title={`Resume your saved project draft (Step ${step})`}
        >
          <span className="size-2 rounded-full bg-zinc-950 animate-pulse shrink-0" />
          <span className="hidden xl:inline">Resume Project</span>
          <span className="xl:hidden">Resume</span>
          <span className="hidden lg:inline-block font-mono text-3xs bg-zinc-950/20 px-1.5 py-0.2 rounded-md font-semibold">
            Step {step}
          </span>
        </Button>
      </Link>
    );
  }

  return (
    <Link href="/new-project" className="shrink-0">
      <Button
        variant="gold"
        size="sm"
        className={cn('gap-1 cursor-pointer whitespace-nowrap', className)}
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
        <span className="hidden lg:inline">New Project</span>
        <span className="lg:hidden">New</span>
      </Button>
    </Link>
  );
}
