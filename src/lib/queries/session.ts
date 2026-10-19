'use client';

import { useEffect } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useUserStore, type StudioTeamRole } from '@/lib/userStore';

export const sessionKeys = {
  all: ['auth'] as const,
  current: ['auth', 'session'] as const,
};

export interface AuthSessionUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
  role: string;
  teamRole?: StudioTeamRole | null;
  isAdmin: boolean;
  emailConfirmed: boolean;
  hasProjects: boolean;
  canChat: boolean;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthSessionUser | null;
}

let activeQueryClient: QueryClient | null = null;

export function registerSessionQueryClient(client: QueryClient) {
  activeQueryClient = client;
}

export function getRegisteredSessionQueryClient(): QueryClient | null {
  return activeQueryClient;
}

/**
 * Synchronizes an authoritative `AuthSessionResponse` into `useUserStore`
 * without triggering unnecessary state updates when values haven't changed.
 */
export function syncSessionResponseToUserStore(data: AuthSessionResponse | null | undefined): boolean {
  if (!data) return false;
  const store = useUserStore.getState();
  const currentUser = store.user;

  if (data.authenticated && data.user) {
    const resolvedName = data.user.name || currentUser?.name || data.user.email?.split('@')[0];
    const resolvedAvatar = data.user.avatarUrl ?? null;
    const resolvedRole = data.user.role || 'client';
    const resolvedTeamRole = data.user.teamRole || null;
    const resolvedEmailVerified = Boolean(data.user.emailConfirmed);
    const resolvedHasProjects = Boolean(data.user.hasProjects);
    const resolvedCanChat = Boolean(data.user.canChat);

    const needsUpdate =
      !currentUser ||
      currentUser.id !== data.user.id ||
      currentUser.email !== data.user.email ||
      currentUser.name !== resolvedName ||
      currentUser.avatarUrl !== resolvedAvatar ||
      currentUser.role !== resolvedRole ||
      currentUser.teamRole !== resolvedTeamRole ||
      currentUser.emailVerified !== resolvedEmailVerified ||
      currentUser.hasProjects !== resolvedHasProjects ||
      currentUser.canChat !== resolvedCanChat;

    if (needsUpdate) {
      store.updateUser({
        id: data.user.id,
        email: data.user.email,
        name: resolvedName,
        avatarUrl: resolvedAvatar,
        role: resolvedRole,
        teamRole: resolvedTeamRole,
        emailVerified: resolvedEmailVerified,
        hasProjects: resolvedHasProjects,
        canChat: resolvedCanChat,
      });
    }
    if (!store.isSessionVerified) {
      store.setSessionVerified(true);
    }
    return true;
  }

  if (data.authenticated === false) {
    if (currentUser?.email) {
      store.signOut();
    } else if (!store.isSessionVerified) {
      store.setSessionVerified(true);
    }
  }
  return false;
}

export async function fetchAuthSession(signal?: AbortSignal): Promise<AuthSessionResponse> {
  const res = await fetch('/api/auth/session', { cache: 'no-store', signal });
  if (!res.ok) {
    throw new Error(`Session check failed (${res.status})`);
  }
  const data = (await res.json()) as AuthSessionResponse;
  syncSessionResponseToUserStore(data);
  return data;
}

/**
 * Fetches or reuses the deduplicated TanStack Query cache entry for `['auth', 'session']`.
 * Used by `RequireAdmin`, `RequireClient`, and `refreshUserSession` so concurrent callers
 * share a single network request.
 */
export async function fetchAndSyncSession(
  queryClient?: QueryClient | null,
  options?: { forceFresh?: boolean }
): Promise<AuthSessionResponse | null> {
  const client = queryClient ?? activeQueryClient;
  const staleTime = options?.forceFresh ? 0 : 15_000;

  try {
    if (client) {
      if (options?.forceFresh) {
        await client.invalidateQueries({ queryKey: sessionKeys.current });
      }
      return await client.fetchQuery({
        queryKey: sessionKeys.current,
        queryFn: ({ signal }) => fetchAuthSession(signal),
        staleTime,
      });
    }
    return await fetchAuthSession();
  } catch {
    return null;
  }
}

/**
 * Shared TanStack Query hook for `/api/auth/session`.
 * Automatically seeds `initialData` when SSR resolved `initialUser` in RootLayout,
 * eliminating redundant mount fetches while keeping window-focus revalidation active.
 */
export function useSessionQuery(options?: {
  enabled?: boolean;
  initialUser?: AuthSessionUser | null;
}) {
  const hasInitial = options?.initialUser !== undefined;

  const query = useQuery<AuthSessionResponse, Error>({
    queryKey: sessionKeys.current,
    enabled: options?.enabled ?? true,
    initialData: hasInitial
      ? {
          authenticated: Boolean(options?.initialUser?.email),
          user: options?.initialUser ?? null,
        }
      : undefined,
    queryFn: ({ signal }) => fetchAuthSession(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });

  useEffect(() => {
    if (query.data) {
      syncSessionResponseToUserStore(query.data);
    }
  }, [query.data]);

  return query;
}
