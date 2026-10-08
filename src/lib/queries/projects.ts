'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectRecord } from '@/types';
import { ApiError } from '@/components/Providers';

export const projectKeys = {
  all: ['projects'] as const,
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

/** Projects visible to the current user (admins see all). */
export function useProjectsQuery() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (res.status === 401) {
        // Unauthenticated guest user has no project records
        return [];
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
      }
      return ((data as { projects?: ProjectRecord[] }).projects || []) as ProjectRecord[];
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
    // Show cached list instantly, but always revalidate on mount so new orders appear.
    staleTime: 0,
  });
}

interface UpdateStatusVars {
  id: string;
  status: ProjectRecord['status'];
  paymentStatus?: ProjectRecord['paymentStatus'];
}

/** Admin status update with optimistic UI and automatic rollback on failure. */
export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: UpdateStatusVars) =>
      fetchJson<{ project: ProjectRecord }>('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      }).then((d) => d.project),

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all });
      const previous = queryClient.getQueryData<ProjectRecord[]>(projectKeys.all);
      queryClient.setQueryData<ProjectRecord[]>(projectKeys.all, (old) =>
        old?.map((p) =>
          p.id === vars.id
            ? { ...p, status: vars.status, paymentStatus: vars.paymentStatus ?? p.paymentStatus }
            : p
        )
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(projectKeys.all, context.previous);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export interface CreateProjectResult {
  success: boolean;
  project: ProjectRecord;
  fundingSource?: string;
  newWalletBalance?: number;
  message?: string;
}

/** Project submission mutation with automatic cache invalidation for both projects and wallet balance. */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJson<CreateProjectResult>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

/** Project cancellation mutation with automatic cache invalidation for both projects and wallet balance. */
export function useCancelProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      fetchJson<{ success: boolean; project: ProjectRecord }>('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, status: 'cancelled' }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

