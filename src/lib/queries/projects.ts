'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import type { ProjectRecord } from '@/types';
import { ApiError } from '@/components/Providers';
import { useUserStore, refreshUserSession } from '@/lib/userStore';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (status?: string, search?: string) => ['projects', status, search] as const,
  infinite: (filters?: {
    status?: string;
    search?: string;
    limit?: number;
    summary?: boolean;
  }) => ['projects', 'infinite', filters] as const,
  admin: (filters: {
    page: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    customer?: string;
    search?: string;
  }) => ['projects', 'admin', filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string | null) => ['projects', 'detail', id] as const,
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
  customers?: Array<{
    clientEmail: string;
    clientName: string;
    count: number;
  }>;
  totalCount: number;
  counts: {
    all: number;
    active: number;
    pending_review?: number;
    payment_confirmed?: number;
    in_production?: number;
    review_round?: number;
    delivered: number;
    declined?: number;
    cancelled?: number;
  };
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

/**
 * Helper to locate a cached ProjectRecord across any active project list query
 * (`['projects', ...]`, `['projects', 'admin', ...]`, or `['projects', 'infinite', ...]`)
 * so project detail drawers open with 0ms latency while fresh signed URLs load.
 */
function findProjectInCache(
  entries: Array<[QueryKey, unknown]>,
  projectId: string
): ProjectRecord | undefined {
  for (const [key, data] of entries) {
    if (!data) continue;
    // Skip the detail query itself so we don't recurse
    if (Array.isArray(key) && key[1] === 'detail') continue;

    // 1. Standard array from useProjectsQuery
    if (Array.isArray(data)) {
      const match = (data as ProjectRecord[]).find((p) => p && p.id === projectId);
      if (match) return match;
    }

    // 2. Paginated response from useAdminProjectsQuery
    if (typeof data === 'object' && 'projects' in data && Array.isArray((data as ProjectsResponse).projects)) {
      const match = (data as ProjectsResponse).projects.find((p) => p && p.id === projectId);
      if (match) return match;
    }

    // 3. InfiniteData from useInfiniteProjectsQuery
    if (typeof data === 'object' && 'pages' in data && Array.isArray((data as InfiniteData<ProjectsResponse>).pages)) {
      for (const page of (data as InfiniteData<ProjectsResponse>).pages) {
        const match = page?.projects?.find((p) => p && p.id === projectId);
        if (match) return match;
      }
    }
  }
  return undefined;
}

/**
 * Helper to apply an updater function to a project across any cached shape under `projectKeys.all`.
 */
function mapProjectAcrossCacheShapes(
  old: unknown,
  projectId: string,
  updater: (project: ProjectRecord) => ProjectRecord
): unknown {
  if (!old) return old;

  // 1. Array of ProjectRecord (useProjectsQuery)
  if (Array.isArray(old)) {
    return (old as ProjectRecord[]).map((p) => (p && p.id === projectId ? updater(p) : p));
  }

  if (typeof old === 'object') {
    // 2. Single ProjectRecord (useProjectDetailQuery)
    if ('id' in old && (old as ProjectRecord).id === projectId && !('projects' in old)) {
      return updater(old as ProjectRecord);
    }

    // 3. ProjectsResponse (useAdminProjectsQuery)
    if ('projects' in old && Array.isArray((old as ProjectsResponse).projects)) {
      const resp = old as ProjectsResponse;
      return {
        ...resp,
        projects: resp.projects.map((p) => (p && p.id === projectId ? updater(p) : p)),
      };
    }

    // 4. InfiniteData<ProjectsResponse> (useInfiniteProjectsQuery)
    if ('pages' in old && Array.isArray((old as InfiniteData<ProjectsResponse>).pages)) {
      const inf = old as InfiniteData<ProjectsResponse>;
      return {
        ...inf,
        pages: inf.pages.map((page) => ({
          ...page,
          projects: Array.isArray(page.projects)
            ? page.projects.map((p) => (p && p.id === projectId ? updater(p) : p))
            : page.projects,
        })),
      };
    }
  }

  return old;
}

/** Projects visible to the current user (admins see all). Returns plain array for standard views. */
export function useProjectsQuery(options?: { enabled?: boolean; status?: string; search?: string }) {
  const isSignedIn = useUserStore((s) => Boolean(s.user?.email && s.isSessionVerified));

  return useQuery({
    queryKey: projectKeys.list(options?.status, options?.search),
    enabled: isSignedIn && (options?.enabled ?? true),
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

/**
 * Unified single project query for on-demand details (including selections, additions, and fresh signed URLs).
 * Seeds `placeholderData` from `initialProject` or any active `projectKeys.all` list query so drawers render in 0ms.
 */
export function useProjectDetailQuery(
  projectId: string | null,
  options?: { enabled?: boolean; initialProject?: ProjectRecord | null }
) {
  const queryClient = useQueryClient();
  const isSignedIn = useUserStore((s) => Boolean(s.user?.email && s.isSessionVerified));

  return useQuery<ProjectRecord | null, ApiError>({
    queryKey: projectKeys.detail(projectId),
    enabled: isSignedIn && Boolean(projectId) && (options?.enabled ?? true),
    placeholderData: () => {
      if (!projectId) return null;
      if (options?.initialProject && options.initialProject.id === projectId) {
        return options.initialProject;
      }
      const entries = queryClient.getQueriesData({ queryKey: projectKeys.all });
      return findProjectInCache(entries, projectId) ?? null;
    },
    queryFn: async () => {
      if (!projectId) return null;
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
      if (res.status === 401 || res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
      }
      return (data as { project?: ProjectRecord }).project || null;
    },
    // Always fetch fresh signed reference image URLs when opening a detail drawer
    staleTime: 0,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        return false;
      }
      return failureCount < 1;
    },
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
  const isSignedIn = useUserStore((s) => Boolean(s.user?.email && s.isSessionVerified));

  return useInfiniteQuery<ProjectsResponse, ApiError>({
    queryKey: projectKeys.infinite({ status, search, limit, summary }),
    enabled: isSignedIn,
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
  customer?: string;
  search?: string;
}) {
  const { page, limit = 25, status, paymentStatus, customer, search } = filters;
  const isVerifiedAdmin = useUserStore((s) =>
    Boolean(s.user?.email && s.user?.role === 'admin' && s.isSessionVerified)
  );

  return useQuery<ProjectsResponse, ApiError>({
    queryKey: projectKeys.admin({ page, limit, status, paymentStatus, customer, search }),
    enabled: isVerifiedAdmin,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('summary', 'true');
      if (status && status !== 'all') params.set('status', status);
      if (paymentStatus && paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
      if (customer && customer !== 'all') params.set('customer', customer);
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
  paymentMethod?: ProjectRecord['paymentMethod'];
}

/**
 * Admin status update with optimistic UI across all project caches
 * (`useProjectsQuery`, `useAdminProjectsQuery`, `useInfiniteProjectsQuery`, `useProjectDetailQuery`)
 * and automatic rollback on failure.
 */
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
      const previousEntries = queryClient.getQueriesData({ queryKey: projectKeys.all });

      queryClient.setQueriesData({ queryKey: projectKeys.all }, (old: unknown) =>
        mapProjectAcrossCacheShapes(old, vars.id, (p) => ({
          ...p,
          status: vars.status,
          paymentStatus: vars.paymentStatus ?? p.paymentStatus,
          paymentMethod: vars.paymentMethod ?? p.paymentMethod,
        }))
      );

      return { previousEntries };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['management'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
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

/** Project submission mutation with automatic cache invalidation for projects, wallet, billing, and management. */
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
        queryClient.setQueryData<ProjectRecord[]>(projectKeys.list(undefined, undefined), (old) => {
          if (!old) return [data.project];
          return [data.project, ...old.filter((p) => p.id !== data.project.id)];
        });
        void refreshUserSession();
      }
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['management'] });
    },
  });
}

/** Project cancellation mutation with optimistic update and cross-domain cache invalidation. */
export function useCancelProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      fetchJson<{ success: boolean; project: ProjectRecord }>('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, status: 'cancelled' }),
      }),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all });
      const previousEntries = queryClient.getQueriesData({ queryKey: projectKeys.all });

      queryClient.setQueriesData({ queryKey: projectKeys.all }, (old: unknown) =>
        mapProjectAcrossCacheShapes(old, projectId, (p) => ({
          ...p,
          status: 'cancelled',
        }))
      );

      return { previousEntries };
    },
    onError: (_err, _projectId, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['management'] });
    },
  });
}


