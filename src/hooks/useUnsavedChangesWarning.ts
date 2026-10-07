'use client';

import { useEffect } from 'react';

/**
 * Standard browser unsaved changes warning.
 * Prompts the user before closing or refreshing the tab if they have active draft progress.
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Standard for modern browsers to prompt: "Changes you made may not be saved."
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
