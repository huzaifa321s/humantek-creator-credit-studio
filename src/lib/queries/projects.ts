'use client';

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { ProjectRecord } from '@/types';
import { ApiError } from '@/components/Providers';
import { useUserStore, refreshUserSession } from '@/lib/userStore';

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

export interface ProjectsResponse {
  projects: ProjectRecord[];
  totalCount: number;
  counts: {
    all: number;
    active: number;
    delivered: number;
  };
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

/** Projects visible to the current user (admins see all). Returns plain array for standard views. */
export function useProjectsQuery(options?: { enabled?: boolean; status?: string; search?: string }) {
  return useQuery({
    queryKey: ['projects', options?.status, options?.search],
    enabled: options?.enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.status && options.status !== 'all') params.set('status', options.status);
      if (options?.search) params.set('search', options.search);
      const url = params.toString() ? `/api/projects?${params.toString()}` : '/api/projects';

      const res = await fetch(url);
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

/** Single project query for on-demand details (including selections & additions) */
export function useProjectDetailQuery(projectId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['projects', 'detail', projectId],
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    queryFn: async () => {
      if (!projectId) return null;
      const res = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`);
      if (res.status === 401 || res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
      }
      return (data as { project?: ProjectRecord }).project || null;
    },
    staleTime: 60_000,
  });
}

/** Client infinite cursor-based pagination query for My Projects */
export function useInfiniteProjectsQuery(filters?: {
  status?: string;
  search?: string;
  limit?: number;
  summary?: boolean;
}) {
  const status = filters?.status;
  const search = filters?.search;
  const limit = filters?.limit ?? 20;
  const summary = filters?.summary ?? true;

  return useInfiniteQuery<ProjectsResponse, ApiError>({
    queryKey: ['projects', 'infinite', { status, search, limit, summary }],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('summary', String(summary));
      if (status && status !== 'all') params.set('status', status);
      if (search && search.trim()) params.set('search', search.trim());
      if (pageParam && typeof pageParam === 'string') params.set('cursor', pageParam);

      const res = await fetch(`/api/projects?${params.toString()}`);
      if (res.status === 401) {
        return {
          projects: [],
          totalCount: 0,
          counts: { all: 0, active: 0, delivered: 0 },
          hasMore: false,
          nextCursor: null,
          limit,
        };
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
      }
      return data as ProjectsResponse;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 0,
  });
}

/** Admin management console query with server-side pagination (25/page), search, and filters */
export function useAdminProjectsQuery(filters: {
  page: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  search?: string;
}) {
  const { page, limit = 25, status, paymentStatus, search } = filters;

  return useQuery<ProjectsResponse, ApiError>({
    queryKey: ['projects', 'admin', { page, limit, status, paymentStatus, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('summary', 'true');
      if (status && status !== 'all') params.set('status', status);
      if (paymentStatus && paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
      if (search && search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/projects?${params.toString()}`);
      if (res.status === 401 || res.status === 403) {
        throw new ApiError('Unauthorized', res.status);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
      }
      return data as ProjectsResponse;
    },
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
      if (data?.project) {
        queryClient.setQueryData<ProjectRecord[]>(projectKeys.all, (old) => {
          if (!old) return [data.project];
          return [data.project, ...old.filter((p) => p.id !== data.project.id)];
        });
        void refreshUserSession();
      }
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

