'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/components/Providers';
import { useUserStore } from '@/lib/userStore';
import { projectKeys } from '@/lib/queries/projects';
import { walletKeys } from '@/lib/queries/wallet';
import { managementKeys } from '@/lib/queries/management';
import type { PaymentPlatform } from '@/lib/payment-platform';
import type { serializeAdminProject } from '@/lib/serializers/project';
import type { ProjectRecord } from '@/types';

export type BillingInvoice = ReturnType<typeof serializeAdminProject> & {
  paymentPlatform: PaymentPlatform;
  paymentReference: string | null;
};

export const billingKeys = {
  all: ['billing'] as const,
  invoices: (scope: 'mine' | 'all') => [...billingKeys.all, scope] as const,
  paypalConfig: ['paypal', 'config'] as const,
};

/**
 * Authoritative billing invoices query (`GET /api/billing`).
 * Supports `scope="mine"` (client view) and `scope="all"` (admin studio-wide view).
 */
export function useBillingInvoicesQuery(scope: 'mine' | 'all') {
  const isSignedIn = useUserStore((s) => Boolean(s.user?.email && s.isSessionVerified));

  return useQuery<BillingInvoice[], ApiError>({
    queryKey: billingKeys.invoices(scope),
    enabled: isSignedIn,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const res = await fetch(scope === 'all' ? '/api/billing?scope=all' : '/api/billing');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (data as { error?: string }).error || `Request failed (${res.status})`,
          res.status
        );
      }
      return ((data as { invoices?: BillingInvoice[] }).invoices || []) as BillingInvoice[];
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Cached PayPal server/client mode configuration query (`GET /api/paypal/config`).
 * Uses `staleTime: Infinity` so navigating back and forth across checkout steps
 * never re-fetches `/api/paypal/config` or causes a button skeleton flash.
 */
export function usePayPalConfigQuery(options?: { enabled?: boolean }) {
  return useQuery<{ mode: 'server' | 'client' }>({
    queryKey: billingKeys.paypalConfig,
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      try {
        const res = await fetch('/api/paypal/config', { cache: 'no-store' });
        if (!res.ok) return { mode: 'client' as const };
        const data = (await res.json()) as { mode?: string };
        return { mode: data.mode === 'server' ? 'server' : 'client' };
      } catch {
        return { mode: 'client' as const };
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Server-validated PayPal order creation mutation (`POST /api/paypal/create-order`).
 */
export function useCreatePayPalOrderMutation() {
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>): Promise<string> => {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to create order');
      }
      return (data as { orderId: string }).orderId;
    },
  });
}

export interface CapturePayPalOrderInput {
  orderId: string;
  projectPayload: Record<string, unknown>;
}

/**
 * Server-validated PayPal order capture mutation (`POST /api/paypal/capture-order`).
 * Automatically updates `useUserStore` wallet balance and invalidates
 * `projectKeys.all`, `walletKeys.all`, `billingKeys.all`, and `managementKeys.all`.
 */
export function useCapturePayPalOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      projectPayload,
    }: CapturePayPalOrderInput): Promise<ProjectRecord | null> => {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, projectPayload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to capture payment');
      }

      if (typeof data.newWalletBalance === 'number') {
        useUserStore.getState().updateUser({ walletBalance: data.newWalletBalance });
      } else if (typeof data.surplusCredits === 'number' && data.surplusCredits > 0) {
        useUserStore
          .getState()
          .addCredits(data.surplusCredits, 'Package unused credits rollover');
      }

      return (data.project as ProjectRecord) || null;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      void queryClient.invalidateQueries({ queryKey: billingKeys.all });
      void queryClient.invalidateQueries({ queryKey: managementKeys.all });
    },
  });
}
