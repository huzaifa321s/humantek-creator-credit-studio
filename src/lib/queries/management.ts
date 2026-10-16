'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/components/Providers';
import { useUserStore } from '@/lib/userStore';
import type { ManagementSummaryData } from '@/app/api/management/summary/route';
import type { LedgerTransaction, LedgerCustomerSummary } from '@/components/AgencyDataGrid';
import type { TeamAccessResponse } from '@/app/api/management/team/route';

interface LedgerResponse {
  transactions: LedgerTransaction[];
  customers?: LedgerCustomerSummary[];
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
    queryKey: ['management', 'summary'],
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
    queryKey: ['management', 'ledger', { page, limit, type, status, customer }],
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
    queryKey: ['management', 'team'],
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

