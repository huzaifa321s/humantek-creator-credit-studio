'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useUserStore, computeInitials } from '@/lib/userStore';
import { useWizardStore } from '@/lib/wizardStore';
import { useNotificationStore } from '@/lib/notificationStore';
import { ChatGateProvider } from '@/components/chat/ChatGate';
import {
  useSessionQuery,
  registerSessionQueryClient,
  type AuthSessionUser,
} from '@/lib/queries/session';

/**
 * Authoritative session sync: uses deduplicated `useSessionQuery` (`['auth', 'session']`)
 * to synchronize the verified user profile & role from PostgreSQL into `useUserStore`.
 * When `initialUser` is passed from SSR (`RootLayout`), `useSessionQuery` seeds `initialData`
 * so the redundant initial mount fetch is skipped while window-focus revalidation stays active.
 */
function SessionSync({
  hasServerInitialUser = false,
  initialUser,
}: {
  hasServerInitialUser?: boolean;
  initialUser?: AuthSessionUser | null;
}) {
  const queryClient = useQueryClient();
  const isHydrated = useUserStore((s) => s.isHydrated);

  useEffect(() => {
    registerSessionQueryClient(queryClient);
  }, [queryClient]);

  // Rehydrate persisted client stores safely in client useEffect
  useEffect(() => {
    if (!hasServerInitialUser) {
      useUserStore.persist.rehydrate();
    }
    useWizardStore.persist.rehydrate();
    useNotificationStore.persist.rehydrate();
  }, [hasServerInitialUser]);

  useSessionQuery({
    enabled: isHydrated,
    initialUser: hasServerInitialUser ? (initialUser ?? null) : undefined,
  });

  return null;
}

export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string | null;
    role: string;
    teamRole?: 'owner' | 'manager' | 'viewer' | null;
    isAdmin: boolean;
    emailConfirmed: boolean;
    hasProjects: boolean;
    canChat: boolean;
  } | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  // Synchronously seed initialUser into userStore during initial SSR and client creation
  useState(() => {
    if (initialUser && initialUser.email) {
      const current = useUserStore.getState().user;
      let cachedBalance = current?.walletBalance;
      if (cachedBalance === undefined && typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('humantek_studio_user');
          if (raw) {
            const parsed = JSON.parse(raw);
            const savedUser = parsed?.state?.user;
            if (
              savedUser &&
              (savedUser.id === initialUser.id ||
                (savedUser.email &&
                  savedUser.email.toLowerCase() === initialUser.email.toLowerCase())) &&
              typeof savedUser.walletBalance === 'number'
            ) {
              cachedBalance = savedUser.walletBalance;
            }
          }
        } catch {
          // Ignore storage read errors
        }
      }
      const userName = initialUser.name || current?.name || initialUser.email.split('@')[0];
      const avatarUrl = initialUser.avatarUrl !== undefined ? initialUser.avatarUrl : (current?.avatarUrl ?? null);
      const teamRole = initialUser.teamRole !== undefined ? initialUser.teamRole : (current?.teamRole ?? null);

      if (
        !current ||
        current.id !== initialUser.id ||
        current.email !== initialUser.email ||
        current.name !== userName ||
        current.avatarUrl !== avatarUrl ||
        current.role !== (initialUser.role || 'client') ||
        current.teamRole !== teamRole ||
        current.emailVerified !== initialUser.emailConfirmed ||
        current.hasProjects !== initialUser.hasProjects ||
        current.canChat !== initialUser.canChat ||
        !useUserStore.getState().isHydrated ||
        !useUserStore.getState().isSessionVerified
      ) {
        useUserStore.setState({
          user: {
            id: initialUser.id,
            name: userName,
            email: initialUser.email,
            avatarUrl,
            avatarInitials: computeInitials(userName, initialUser.email),
            walletBalance: cachedBalance ?? 0,
            role: initialUser.role || 'client',
            teamRole,
            emailVerified: initialUser.emailConfirmed,
            hasProjects: initialUser.hasProjects,
            canChat: initialUser.canChat,
          },
          isHydrated: true,
          isSessionVerified: true,
        });
      }
    } else if (initialUser === null) {
      // Server explicitly verified there is no active session cookie:
      // clear any stale persisted user in localStorage immediately so the UI never flashes a logged-out user's avatar
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('humantek_studio_user');
        } catch {
          // Ignore storage errors
        }
      }
      useUserStore.setState({
        user: null,
        isHydrated: true,
        isSessionVerified: true,
        hasSyncedInitialBalance: false,
        recentCreditDelta: null,
      });
    }
  });

  return <>{children}</>;
}

/**
 * App-wide client providers. A QueryClient is created once per browser
 * session (inside state) so it is never shared between server requests.
 */
export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: AuthProviderProps['initialUser'];
}) {
  const hasServerInitialUser = initialUser !== undefined;
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
        <AuthProvider initialUser={initialUser}>
          <SessionSync hasServerInitialUser={hasServerInitialUser} initialUser={initialUser} />
          <ChatGateProvider>
            {children}
          </ChatGateProvider>
        </AuthProvider>
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
