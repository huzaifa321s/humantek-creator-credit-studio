'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

const subscribe = () => () => {};

/**
 * Universal ClientOnly wrapper for browser-dependent UI components.
 * Renders `fallback` on the server and initial client hydration paint,
 * then renders `children` as soon as hydration completes.
 * Guarantees zero hydration mismatch for dynamic browser state (localStorage, screen size, etc.).
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return hydrated ? <>{children}</> : <>{fallback}</>;
}
