'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useUserStore } from '@/lib/userStore';

/**
 * Authoritative session sync: queries `/api/auth/session` on mount to sync
 * the verified user profile & role from the PostgreSQL database into the client store.
 * This automatically corrects any stale elevated roles (e.g. 'admin') in localStorage
 * so that client roles are strictly and reliably enforced.
 */
function SessionSync() {
  const isHydrated = useUserStore((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated) return;
    let isCancelled = false;

    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isCancelled || !data) return;
        const currentUser = useUserStore.getState().user;
        if (data.authenticated && data.user) {
          // Strictly prevent unnecessary state updates if profile is already up-to-date
          const needsUpdate =
            !currentUser ||
            currentUser.id !== data.user.id ||
            currentUser.email !== data.user.email ||
            currentUser.role !== (data.user.role || 'client');

          if (needsUpdate) {
            useUserStore.getState().updateUser({
              id: data.user.id,
              email: data.user.email,
              role: data.user.role || 'client',
            });
          }
        } else if (!data.authenticated) {
          // If server session is unauthenticated, clear stale user state
          if (currentUser?.email && currentUser.email !== 'dev@localhost') {
            useUserStore.getState().signOut();
          }
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [isHydrated]);

  return null;
}

/**
 * App-wide client providers. A QueryClient is created once per browser
 * session (inside state) so it is never shared between server requests.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // Don't retry auth / validation failures.
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      <QueryClientProvider client={queryClient}>
        <SessionSync />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** Error thrown by API helpers, carrying the HTTP status. */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}
