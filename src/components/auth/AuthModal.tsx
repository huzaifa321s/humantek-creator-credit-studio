'use client';

import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import { Sparkles, X } from 'lucide-react';
import { AuthForm } from './AuthForm';
import { StudioUser } from '@/lib/userStore';
import { ClientOnly } from '@/components/ClientOnly';

export interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user?: StudioUser) => void;
  initialMode?: 'signin' | 'signup';
  defaultEmail?: string;
}

/**
 * Responsive Auth Dialog:
 * - Renders a centered modal (`Dialog`) on desktop viewports.
 * - Renders a native bottom drawer (`Drawer`) on mobile viewports.
 * Wrapped with ClientOnly to guarantee deterministic SSR without viewport mismatch.
 */
export function AuthModal(props: AuthModalProps) {
  return (
    <ClientOnly fallback={null}>
      <ResponsiveAuthModalContent {...props} />
    </ClientOnly>
  );
}

function ResponsiveAuthModalContent({
  open,
  onOpenChange,
  onSuccess,
  initialMode = 'signin',
  defaultEmail = '',
}: AuthModalProps) {
  const isMobile = useIsMobile();

  const titleText = 'Sign in to continue';
  const descriptionText = 'Save your brief and continue to review your project.';

  // 1. Mobile Phone Viewport -> Bottom Drawer
  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        showSwipeHandle={true}
        swipeDirection="down"
      >
        <DrawerContent
          data-testid="auth-drawer"
          className="max-h-[92dvh] bg-card border-t border-border p-0 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="mx-auto w-12 h-1 rounded-full bg-muted-foreground/20 my-2 shrink-0" />
          
          <DrawerHeader className="px-4 py-2.5 border-b border-border/70 flex flex-row items-center justify-between shrink-0 text-left">
            <div className="flex items-center gap-2.5 min-w-0 text-left">
              <div className="size-7 rounded-lg bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-brand-text dark:text-amber-400 shrink-0">
                <Sparkles className="size-3.5" />
              </div>
              <div className="min-w-0 text-left">
                <DrawerTitle className="text-sm font-bold text-foreground text-left tracking-tight">
                  {titleText}
                </DrawerTitle>
                <DrawerDescription className="text-2xs text-muted-foreground text-left mt-0.5">
                  {descriptionText}
                </DrawerDescription>
              </div>
            </div>

            <DrawerClose
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
              aria-label="Close drawer"
            >
              <X className="size-4" />
            </DrawerClose>
          </DrawerHeader>

          <div className="overflow-y-auto overscroll-contain flex-1 px-4 py-3.5 pb-8">
            <AuthForm
              initialMode={initialMode}
              defaultEmail={defaultEmail}
              onSuccess={(user) => {
                onOpenChange(false);
                onSuccess(user);
              }}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // 2. Desktop Viewport -> Centered Modal Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="auth-dialog"
        className="sm:max-w-md p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xl space-y-4"
      >
        <DialogHeader className="space-y-0 text-left pb-1">
          <div className="flex items-center gap-2.5 text-left">
            <div className="size-8 rounded-lg bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-brand-text dark:text-amber-400 shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 text-left">
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground text-left tracking-tight">
                {titleText}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground text-left mt-0.5 leading-normal">
                {descriptionText}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <AuthForm
          initialMode={initialMode}
          defaultEmail={defaultEmail}
          onSuccess={(user) => {
            onOpenChange(false);
            onSuccess(user);
          }}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
