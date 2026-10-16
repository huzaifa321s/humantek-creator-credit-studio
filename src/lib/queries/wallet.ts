'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreditLedgerEntry } from '@/types';
import { ApiError } from '@/components/Providers';
import { useUserStore } from '@/lib/userStore';

export const walletKeys = {
  all: ['wallet'] as const,
  balance: (email?: string | null) =>
    [...walletKeys.all, 'balance', (email || 'anonymous').toLowerCase().trim()] as const,
  ledger: (email?: string | null) =>
    [...walletKeys.all, 'ledger', (email || 'anonymous').toLowerCase().trim()] as const,
  gifts: (email?: string | null) =>
    [...walletKeys.all, 'gifts', (email || 'anonymous').toLowerCase().trim()] as const,
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
  balancePurchased?: number;
  balancePromo?: number;
  ledger: CreditLedgerEntry[];
}

/**
 * Authoritative wallet balance and ledger query for the active user.
 * Automatically synchronizes with local userStore whenever fresh data arrives.
 */
export function useWalletQuery(email?: string | null) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const userRole = useUserStore((s) => s.user?.role);
  const isAdmin = Boolean(userRole && userRole.toLowerCase() === 'admin');

  const query = useQuery({
    queryKey: walletKeys.balance(normalizedEmail || 'none'),
    queryFn: async ({ signal }) => {
      return fetchJson<WalletApiResponse>(
        `/api/wallet`,
        { signal }
      );
    },
    enabled: Boolean(normalizedEmail) && !isAdmin,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  // Keep local userStore seamlessly synchronized with fresh authoritative server balance
  useEffect(() => {
    if (query.data && typeof query.data.walletBalance === 'number') {
      const store = useUserStore.getState();
      const currentUser = store.user;
      if (currentUser && currentUser.walletBalance !== query.data.walletBalance) {
        store.updateUser({ walletBalance: query.data.walletBalance });
      }
      if (!store.hasSyncedInitialBalance) {
        store.markInitialBalanceSynced();
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
  sharedBy?: {
    name: string;
    email: string;
    note?: string;
  } | null;
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

export interface GiftPromoRecordItem {
  id: string;
  code: string;
  credits: number;
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  note?: string;
  status: 'active' | 'claimed';
  claimedByEmail?: string | null;
  claimedAt?: string | null;
  createdAt: string;
}

export interface GiftPromosApiResponse {
  success: boolean;
  sentGifts: GiftPromoRecordItem[];
  receivedGifts: GiftPromoRecordItem[];
}

export function useGiftPromoCodesQuery(email?: string | null) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const userRole = useUserStore((s) => s.user?.role);
  const isAdmin = Boolean(userRole && userRole.toLowerCase() === 'admin');

  return useQuery({
    queryKey: walletKeys.gifts(normalizedEmail || 'none'),
    queryFn: async ({ signal }) => {
      return fetchJson<GiftPromosApiResponse>('/api/wallet/gift', { signal });
    },
    enabled: Boolean(normalizedEmail) && !isAdmin,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export interface CreateGiftPromoInput {
  recipientEmail: string;
  credits: number;
  note?: string;
}

export interface CreateGiftPromoResult {
  success: boolean;
  gift: GiftPromoRecordItem;
  newWalletBalance: number;
  message: string;
}

export function useCreateGiftPromoCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGiftPromoInput) => {
      return fetchJson<CreateGiftPromoResult>('/api/wallet/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: input.recipientEmail.trim().toLowerCase(),
          credits: input.credits,
          note: input.note?.trim() || undefined,
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
