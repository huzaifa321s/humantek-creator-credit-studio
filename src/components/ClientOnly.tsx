'use client';

import { useState, useEffect, type ReactNode } from 'react';

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
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
