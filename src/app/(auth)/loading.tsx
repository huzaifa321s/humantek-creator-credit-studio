import React from 'react';
import { Spinner } from '@/components/ui/spinner';

/**
 * Loading UI for /login and /sign-in.
 * Overrides the root loading screen so guests never see the dashboard header,
 * sidebar and page skeleton while the sign-in page loads.
 */
export default function AuthLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading sign in"
      className="flex w-full items-center justify-center py-16"
    >
      <Spinner className="size-10 text-amber-500" />
    </div>
  );
}
