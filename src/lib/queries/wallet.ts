'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreditLedgerEntry } from '@/types';
import { ApiError } from '@/components/Providers';
import { useUserStore } from '@/lib/userStore';

export const walletKeys = {
  all: ['wallet'] as const,
  balance: (email?: string | null) =>
    [...walletKeys.all, 'balance', (email || 'kira@example.com').toLowerCase().trim()] as const,
  ledger: (email?: string | null) =>
    [...walletKeys.all, 'ledger', (email || 'kira@example.com').toLowerCase().trim()] as const,
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error || `Request failed (${res.status})`,
      res.status
    );
  }
  return data as T;
}

export interface WalletApiResponse {
  success: boolean;
  email: string;
  walletBalance: number;
  ledger: CreditLedgerEntry[];
}

/**
 * Authoritative wallet balance and ledger query for the active user.
 * Automatically synchronizes with local userStore whenever fresh data arrives.
 */
export function useWalletQuery(email?: string | null) {
  const normalizedEmail = (email || 'kira@example.com').toLowerCase().trim();

  const query = useQuery({
    queryKey: walletKeys.balance(normalizedEmail),
    queryFn: async ({ signal }) => {
      return fetchJson<WalletApiResponse>(
        `/api/wallet?email=${encodeURIComponent(normalizedEmail)}`,
        { signal }
      );
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  // Keep local userStore seamlessly synchronized with fresh authoritative server balance
  useEffect(() => {
    if (query.data && typeof query.data.walletBalance === 'number') {
      const currentBalance = useUserStore.getState().user.walletBalance;
      if (currentBalance !== query.data.walletBalance) {
        useUserStore.getState().updateUser({ walletBalance: query.data.walletBalance });
      }
    }
  }, [query.data]);

  return query;
}

export interface RedeemPromoInput {
  code: string;
  email?: string;
}

export interface RedeemPromoResult {
  success: boolean;
  code: string;
  creditsAdded: number;
  newWalletBalance: number;
  message: string;
}

/**
 * Mutation for redeeming a promo code or voucher.
 * Automatically updates userStore balance and invalidates wallet queries on success.
 */
export function useRedeemPromoCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, email }: RedeemPromoInput) => {
      return fetchJson<RedeemPromoResult>('/api/wallet/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          email: (email || 'kira@example.com').toLowerCase().trim(),
        }),
      });
    },
    onSuccess: (data) => {
      if (typeof data.newWalletBalance === 'number') {
        useUserStore.getState().updateUser({ walletBalance: data.newWalletBalance });
      }
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}
