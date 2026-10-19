'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/components/Providers';
import { useUserStore } from '@/lib/userStore';
import type { TeamRole } from '@/lib/auth';
import type { ManagementSummaryData } from '@/app/api/management/summary/route';
import type {
  LedgerTransaction,
  LedgerCustomerSummary,
  SharedPromoAuditLogItem,
} from '@/components/AgencyDataGrid';
import type { TeamAccessResponse, TeamMemberRecord } from '@/app/api/management/team/route';

export const managementKeys = {
  all: ['management'] as const,
  summary: ['management', 'summary'] as const,
  ledger: (filters?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    customer?: string;
  }) => ['management', 'ledger', filters] as const,
  team: ['management', 'team'] as const,
};

interface LedgerResponse {
  transactions: LedgerTransaction[];
  customers?: LedgerCustomerSummary[];
  sharedPromos?: SharedPromoAuditLogItem[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

/**
 * Live executive management summary and KPI counts query.
 * Refetches automatically every 30 seconds to keep badges live.
 */
export function useManagementSummaryQuery() {
  const isVerifiedAdmin = useUserStore((s) =>
    Boolean(s.user?.email && s.user?.role === 'admin' && s.isSessionVerified)
  );

  return useQuery<ManagementSummaryData, ApiError>({
    queryKey: managementKeys.summary,
    enabled: isVerifiedAdmin,
    queryFn: async () => {
      const res = await fetch('/api/management/summary');
      if (res.status === 401 || res.status === 403) {
        throw new ApiError('Unauthorized', res.status);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (data as { error?: string }).error || `Summary request failed (${res.status})`,
          res.status
        );
      }
      return data as ManagementSummaryData;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Audited credit ledger transaction history query.
 */
export function useManagementLedgerQuery(filters?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  customer?: string;
}) {
  const { page = 1, limit = 500, type, status, customer } = filters || {};
  const isVerifiedAdmin = useUserStore((s) =>
    Boolean(s.user?.email && s.user?.role === 'admin' && s.isSessionVerified)
  );

  return useQuery<LedgerResponse, ApiError>({
    queryKey: managementKeys.ledger({ page, limit, type, status, customer }),
    enabled: isVerifiedAdmin,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (type && type !== 'all') params.set('type', type);
      if (status && status !== 'all') params.set('status', status);
      if (customer && customer !== 'all') params.set('customer', customer);

      const res = await fetch(`/api/management/ledger?${params.toString()}`);
      if (res.status === 401 || res.status === 403) {
        throw new ApiError('Unauthorized', res.status);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (data as { error?: string }).error || `Ledger request failed (${res.status})`,
          res.status
        );
      }
      return data as LedgerResponse;
    },
    staleTime: 10_000,
  });
}

/**
 * Team Access approved accounts and role query.
 */
export function useManagementTeamQuery() {
  const isVerifiedOwner = useUserStore((s) =>
    Boolean(
      s.user?.email &&
        s.user?.role === 'admin' &&
        s.user?.teamRole === 'owner' &&
        s.isSessionVerified
    )
  );

  return useQuery<TeamAccessResponse, ApiError>({
    queryKey: managementKeys.team,
    enabled: isVerifiedOwner,
    queryFn: async () => {
      const res = await fetch('/api/management/team');
      if (res.status === 401 || res.status === 403) {
        throw new ApiError('Unauthorized', res.status);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (data as { error?: string }).error || `Team access request failed (${res.status})`,
          res.status
        );
      }
      return data as TeamAccessResponse;
    },
    staleTime: 15_000,
  });
}

export interface AddTeamMemberInput {
  name?: string;
  email: string;
  teamRole: 'manager' | 'viewer';
  password?: string;
}

/**
 * Add or promote a team member (POST /api/management/team) and invalidate management queries.
 */
export function useAddTeamMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddTeamMemberInput) => {
      const res = await fetch('/api/management/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name?.trim(),
          email: input.email.trim().toLowerCase(),
          teamRole: input.teamRole,
          password: input.password?.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (json as { error?: string }).error || 'Could not add team member.',
          res.status
        );
      }
      return json as { ok: boolean; member?: TeamMemberRecord };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.team });
      void queryClient.invalidateQueries({ queryKey: managementKeys.summary });
    },
  });
}

/**
 * Update a team member's role (PATCH /api/management/team) with optimistic UI and automatic rollback.
 */
export function useUpdateTeamRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, teamRole }: { userId: string; teamRole: TeamRole }) => {
      const res = await fetch('/api/management/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, teamRole }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (json as { error?: string }).error || 'Could not update role.',
          res.status
        );
      }
      return json as { ok: boolean; member?: TeamMemberRecord };
    },
    onMutate: async ({ userId, teamRole }) => {
      await queryClient.cancelQueries({ queryKey: managementKeys.team });
      const previous = queryClient.getQueryData<TeamAccessResponse>(managementKeys.team);

      queryClient.setQueryData<TeamAccessResponse>(managementKeys.team, (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.map((m) =>
            m.id === userId ? { ...m, teamRole } : m
          ),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(managementKeys.team, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.team });
    },
  });
}

/**
 * Revoke a team member's management access (DELETE /api/management/team) with optimistic UI.
 */
export function useRemoveTeamMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/management/team?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (json as { error?: string }).error || 'Could not remove access.',
          res.status
        );
      }
      return json as { ok: boolean };
    },
    onMutate: async (userId: string) => {
      await queryClient.cancelQueries({ queryKey: managementKeys.team });
      const previous = queryClient.getQueryData<TeamAccessResponse>(managementKeys.team);

      queryClient.setQueryData<TeamAccessResponse>(managementKeys.team, (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.filter((m) => m.id !== userId),
        };
      });

      return { previous };
    },
    onError: (_err, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(managementKeys.team, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.team });
      void queryClient.invalidateQueries({ queryKey: managementKeys.summary });
    },
  });
}


