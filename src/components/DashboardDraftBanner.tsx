'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileEdit, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useActiveWizardDraft } from '@/lib/wizardStore';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function DashboardDraftBanner() {
  const { hasDraft, step, packageName, channelName, itemsCount, resetWizard } = useActiveWizardDraft();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  if (!hasDraft) return null;

  const handleDiscard = () => {
    resetWizard();
    setIsResetDialogOpen(false);
    toast.success('Draft discarded. Ready to start fresh from Step 1.', { duration: 2500 });
  };

  const draftTitle = channelName
    ? channelName
    : packageName
    ? packageName
    : 'Creative Project';

  return (
    <div className="rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-400/[0.08] via-amber-400/[0.04] to-transparent p-4 sm:p-4.5 shadow-2xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-zinc-950 font-bold shadow-xs shadow-amber-400/25">
            <FileEdit className="size-4.5" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                Unsaved Project Draft: {draftTitle}
              </span>
              <Badge variant="gold" className="text-3xs font-mono font-bold px-1.5 py-0">
                Step {step} of 5
              </Badge>
              {itemsCount > 0 && (
                <span className="text-2xs text-muted-foreground hidden md:inline">
                  · {itemsCount} deliverable{itemsCount === 1 ? '' : 's'} selected
                </span>
              )}
            </div>
            <p className="text-2xs sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
              You have an unfinished project brief in progress. Resume where you left off or discard to start fresh.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer rounded-lg px-2.5 gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  <span>Discard</span>
                </Button>
              }
            />
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this project draft?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  This will remove your saved brief details, chosen package, and selected deliverables from your browser. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel className="text-xs">Keep Draft</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDiscard}
                  className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Discard Draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Link href="/new-project">
            <Button
              variant="gold"
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer rounded-lg px-3 shadow-xs"
            >
              <span>Resume Project</span>
              <ArrowRight className="size-3.5 stroke-[2.5]" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
