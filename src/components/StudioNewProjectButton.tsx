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
      <Link href="/new-project">
        <Button
          variant="gold"
          size="sm"
          className={cn(
            'gap-1.5 cursor-pointer relative shadow-xs shadow-amber-400/25 ring-1 ring-amber-400/50',
            className
          )}
          title="Resume your saved project draft"
        >
          <span className="size-2 rounded-full bg-zinc-950 animate-pulse" />
          <span className="hidden min-[440px]:inline">Resume Project</span>
          <span className="min-[440px]:hidden">Resume</span>
          <span className="hidden sm:inline-block font-mono text-3xs bg-zinc-950/20 px-1.5 py-0.2 rounded-md font-semibold">
            Step {step}
          </span>
        </Button>
      </Link>
    );
  }

  return (
    <Link href="/new-project">
      <Button
        variant="gold"
        size="sm"
        className={cn('gap-1 cursor-pointer', className)}
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="hidden min-[400px]:inline">New Project</span>
        <span className="min-[400px]:hidden">New</span>
      </Button>
    </Link>
  );
}
