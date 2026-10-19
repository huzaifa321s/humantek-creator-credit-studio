'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/components/Providers';
import { useUserStore } from '@/lib/userStore';
import { managementKeys } from '@/lib/queries/management';
import { projectKeys } from '@/lib/queries/projects';
import type { UserProfileResponse } from '@/app/api/profile/route';

export const profileKeys = {
  all: ['user', 'profile'] as const,
  detail: (userId?: string | null) => [...profileKeys.all, userId || 'me'] as const,
};

export interface ProfileInitialUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'client' | 'admin';
  teamRole: 'owner' | 'manager' | 'viewer' | null;
}

/**
 * Authoritative user profile query (`GET /api/profile`).
 * Seeds `initialData` from SSR `initialUser` so `/profile` renders with 0ms latency
 * and skips redundant immediate mount refetches during the 15s stale window.
 */
export function useProfileQuery(initialUser?: ProfileInitialUser) {
  const storeUser = useUserStore((s) => s.user);
  const userId = initialUser?.id || storeUser?.id || 'me';

  return useQuery<{ profile: UserProfileResponse }, ApiError>({
    queryKey: profileKeys.detail(userId),
    initialData: initialUser
      ? {
          profile: {
            id: initialUser.id,
            name: initialUser.name,
            email: initialUser.email,
            avatarUrl: initialUser.avatarUrl,
            role: initialUser.role,
            teamRole: initialUser.teamRole,
            isAdmin: initialUser.role === 'admin',
            emailConfirmed: true,
            createdAt: '',
            authProvider: 'email',
          },
        }
      : undefined,
    queryFn: async () => {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (json as { error?: string }).error || 'Failed to load profile',
          res.status
        );
      }
      return json as { profile: UserProfileResponse };
    },
    staleTime: 15_000,
  });
}

/**
 * Mutation to update user profile display name (`PATCH /api/profile`).
 * Optimistically updates `useUserStore` and `profileKeys.all` and invalidates
 * `managementKeys.team` and `projectKeys.all`.
 */
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (json as { error?: string }).error || 'Could not update name.',
          res.status
        );
      }
      return json as { ok: boolean; profile?: UserProfileResponse };
    },
    onMutate: async ({ name }) => {
      const cleanName = name.trim();
      await queryClient.cancelQueries({ queryKey: profileKeys.all });
      const previousProfiles = queryClient.getQueriesData<{ profile: UserProfileResponse }>({
        queryKey: profileKeys.all,
      });
      const previousStoreName = useUserStore.getState().user?.name;

      useUserStore.getState().updateUser({ name: cleanName });

      queryClient.setQueriesData<{ profile: UserProfileResponse }>(
        { queryKey: profileKeys.all },
        (old) => {
          if (!old?.profile) return old;
          return {
            profile: {
              ...old.profile,
              name: cleanName,
            },
          };
        }
      );

      return { previousProfiles, previousStoreName };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProfiles) {
        for (const [key, data] of context.previousProfiles) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousStoreName) {
        useUserStore.getState().updateUser({ name: context.previousStoreName });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
      void queryClient.invalidateQueries({ queryKey: managementKeys.team });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
