'use client';

import { useEffect, useRef } from 'react';

export const STEP_METADATA: Record<number, { title: string; announcement: string }> = {
  1: {
    title: 'Choose your package or wallet',
    announcement: 'Step 1 of 5: Package',
  },
  2: {
    title: 'Select the services you need',
    announcement: 'Step 2 of 5: Services',
  },
  3: {
    title: 'Quick studio rules check',
    announcement: 'Step 3 of 5: Guidelines',
  },
  4: {
    title: 'Share your project details',
    announcement: 'Step 4 of 5: Details',
  },
  5: {
    title: 'Review and launch your project',
    announcement: 'Step 5 of 5: Review',
  },
};

export function getStepAnnouncement(step: number, isSubmitted: boolean): string {
  if (isSubmitted) {
    return 'Order confirmed. We have received your order.';
  }
  return STEP_METADATA[step]?.announcement || `Step ${step} of 5`;
}

/**
 * Professional step navigation & accessibility focus hook.
 *
 * Requirements:
 * 1. Instant scroll reset to top of step (window & documentElement) on step change
 * 2. Does not jump or steal focus on initial page mount
 * 3. Focuses the active step's heading (tabIndex={-1}) with preventScroll: true
 *    so keyboard & screen reader users immediately know where they are
 * 4. Screen reader announcements via aria-live polite region
 * 5. Supports transition to order confirmation view as well
 */
export function useStepFocus(step: number, secondaryKey?: unknown) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Avoid stealing focus or jumping scroll on cold initial mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Professional standard: Instant reset to top of step
    // Using instant (not smooth) avoids disorienting users across long jumps
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    // Focus active heading with preventScroll: true so focus does not conflict with scroll
    const rafId = requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(rafId);
  }, [step, secondaryKey]);

  return headingRef;
}
