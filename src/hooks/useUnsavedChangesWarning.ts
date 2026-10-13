'use client';

import { useEffect } from 'react';

let isBypassed = false;

/**
 * Explicitly bypasses the browser's beforeunload warning.
 * Used during intentional external redirects (e.g. Google OAuth login,
 * verified project submissions, or payment redirects).
 */
export function bypassUnsavedChangesWarning(bypass = true) {
  isBypassed = bypass;
  if (typeof window !== 'undefined') {
    (window as unknown as { __bypassUnsavedWarning?: boolean }).__bypassUnsavedWarning = bypass;
  }
}

/**
 * Standard browser unsaved changes warning.
 * Prompts the user before closing or refreshing the tab if they have active draft progress,
 * but gracefully permits seamless Google OAuth authentication and intentional submissions
 * without ever popping up the native leave/cancel modal.
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Capture-phase click listener to catch OAuth / Google button interactions immediately
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const bypassBtn = target.closest(
        'button[data-auth-google="true"], button[data-oauth="true"], [data-bypass-warning="true"]'
      );
      if (bypassBtn) {
        bypassUnsavedChangesWarning(true);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isWindowBypassed =
        typeof window !== 'undefined' &&
        Boolean((window as unknown as { __bypassUnsavedWarning?: boolean }).__bypassUnsavedWarning);

      if (isBypassed || isWindowBypassed) {
        return;
      }

      e.preventDefault();
      // Standard for modern browsers to prompt: "Changes you made may not be saved."
      e.returnValue = '';
    };

    window.addEventListener('click', handleGlobalClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('click', handleGlobalClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}

