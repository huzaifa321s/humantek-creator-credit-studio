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
  DrawerSwipeHandle,
} from '@/components/ui/drawer';
import { Sparkles } from 'lucide-react';
import { AuthForm } from './AuthForm';
import { StudioUser } from '@/lib/userStore';

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
 * Both host the unified, accessible `AuthForm`.
 */
export function AuthModal({
  open,
  onOpenChange,
  onSuccess,
  initialMode = 'signin',
  defaultEmail = '',
}: AuthModalProps) {
  const isMobile = useIsMobile();

  const titleText = 'Sign in to review & launch';
  const descriptionText =
    'Sign in or create an account to save your brief and continue to Step 5 (Review & Pay). Your selected package, services, and brief are kept completely intact.';

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
          className="max-h-[90dvh] bg-card border-t border-border px-5 pb-8 pt-2 rounded-t-3xl shadow-2xl flex flex-col"
        >
          <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-2 shrink-0" />
          
          <DrawerHeader className="px-0 pt-1 pb-3 text-left shrink-0">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                <Sparkles className="size-4" />
              </div>
              <DrawerTitle className="text-base font-extrabold text-foreground">
                {titleText}
              </DrawerTitle>
            </div>
            <DrawerDescription className="text-xs text-muted-foreground mt-1">
              {descriptionText}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto overscroll-contain flex-1 pr-0.5">
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
        className="sm:max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl"
      >
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 font-bold text-xs">
              <Sparkles className="size-4" />
            </div>
            <DialogTitle className="text-lg font-extrabold text-foreground">
              {titleText}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-1">
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
      </DialogContent>
    </Dialog>
  );
}
