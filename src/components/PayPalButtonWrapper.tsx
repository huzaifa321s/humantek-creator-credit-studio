'use client';

import { useEffect, useState } from 'react';
import { PayPalScriptProvider, PayPalButtons, FUNDING, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import type { CreateOrderActions, OnApproveActions } from '@paypal/paypal-js';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { ProjectRecord } from '@/types';
import { useUserStore } from '@/lib/userStore';
import { projectKeys } from '@/lib/queries/projects';
import { walletKeys } from '@/lib/queries/wallet';
import {
  buildPayPalOrderDetails,
  buildPurchaseUnit,
  PAYPAL_APPLICATION_CONTEXT,
} from '@/lib/paypal-order-details';
import {
  isPayPalClientConfigured,
  PAYPAL_CLIENT_ID,
  PAYPAL_CURRENCY,
  PAYPAL_ENABLE_FUNDING,
  PAYPAL_MERCHANT_ID,
} from '@/lib/paypal-config';

/** Payment captured in the browser (client-id-only checkout); verified by the studio in PayPal. */
export interface ClientCapturedPayment {
  orderId: string;
  captureId: string | null;
  status: string;
  amount: string;
  payerEmail: string | null;
}

interface PayPalButtonWrapperProps {
  packageId: string;
  packagePrice: number;
  packageName: string;
  packageCredits: number;
  customer: { name: string; email: string };
  projectPayload: Record<string, unknown>;
  onSuccess: (project: ProjectRecord | null) => void;
  /** Client-id-only mode: called after the browser captured the payment. */
  onClientCaptured: (payment: ClientCapturedPayment) => void;
  onError: (msg: string) => void;
}

/**
 * Pixel-matched button skeletons mirroring the exact heights (44px) and gaps
 * of the 3 PayPal buttons. Prevents Cumulative Layout Shift (CLS) while PayPal SDK loads.
 */
export function PaymentButtonsSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse" aria-label="Loading payment options...">
      {/* 1. Pay with PayPal slot */}
      <div className="h-11 w-full rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
        <div className="h-4 w-28 bg-amber-400/30 rounded-md" />
      </div>

      {/* 2. Pay Later slot */}
      <div className="h-11 w-full rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
        <div className="h-4 w-20 bg-amber-400/20 rounded-md" />
      </div>

      {/* 3. Debit or Credit Card slot */}
      <div className="h-11 w-full rounded-lg bg-secondary/70 border border-border/80 flex items-center justify-center">
        <div className="h-4 w-32 bg-muted-foreground/20 rounded-md" />
      </div>
    </div>
  );
}

function PayPalButtonsContent({
  createCommonButtonProps,
}: {
  createCommonButtonProps: (fundingSource: (typeof FUNDING)[keyof typeof FUNDING]) => Record<string, unknown>;
}) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();

  if (isPending) {
    return <PaymentButtonsSkeleton />;
  }

  if (isRejected) {
    return (
      <div className="p-3.5 text-center rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
        <div className="flex items-center justify-center gap-1.5 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Unable to connect to PayPal</span>
        </div>
        <p className="text-2xs text-muted-foreground">
          Please check your connection or temporarily disable strict ad-blockers and refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 animate-in fade-in duration-200">
      {/* Pay with PayPal (Vibrant Official Gold) */}
      <div className="rounded-lg overflow-hidden">
        <PayPalButtons
          style={{
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'pay',
            height: 44,
          }}
          {...createCommonButtonProps(FUNDING.PAYPAL)}
        />
      </div>

      {/* Pay Later (Vibrant Official Gold) */}
      <div className="rounded-lg overflow-hidden">
        <PayPalButtons
          style={{
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            height: 44,
          }}
          {...createCommonButtonProps(FUNDING.PAYLATER)}
        />
      </div>

      {/* Venmo (renders only for eligible US buyers) */}
      <div className="rounded-lg overflow-hidden empty:hidden">
        <PayPalButtons
          style={{
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            height: 44,
          }}
          {...createCommonButtonProps(FUNDING.VENMO)}
        />
      </div>

      {/* Debit or Credit Card (Crisp Black/Dark Charcoal) */}
      <div className="rounded-lg overflow-hidden">
        <PayPalButtons
          style={{
            layout: 'vertical',
            color: 'black',
            shape: 'rect',
            height: 44,
          }}
          {...createCommonButtonProps(FUNDING.CARD)}
        />
      </div>
    </div>
  );
}

export function PayPalButtonWrapper({
  packageId,
  packagePrice,
  packageName,
  packageCredits,
  customer,
  projectPayload,
  onSuccess,
  onClientCaptured,
  onError,
}: PayPalButtonWrapperProps) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'server' | 'client' | null>(null);
  const isPlaceholderClientId = !isPayPalClientConfigured();
  const clientId = PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (isPlaceholderClientId) return;
    let cancelled = false;
    fetch('/api/paypal/config')
      .then((res) => (res.ok ? res.json() : { mode: 'client' }))
      .catch(() => ({ mode: 'client' }))
      .then((data: { mode?: string }) => {
        if (!cancelled) setMode(data.mode === 'server' ? 'server' : 'client');
      });
    return () => {
      cancelled = true;
    };
  }, [isPlaceholderClientId]);

  const projectRef = typeof projectPayload.projectId === 'string' ? projectPayload.projectId : packageId;

  /** Client-id-only: PayPal JS SDK creates the order with the package details attached. */
  const createClientOrder = (actions: CreateOrderActions) =>
    actions.order.create({
      intent: 'CAPTURE',
      purchase_units: [
        buildPurchaseUnit(
          packagePrice,
          `${projectRef}|${customer.email}`.slice(0, 127),
          buildPayPalOrderDetails({
            internalOrderId: projectRef,
            package: { name: packageName, credits: packageCredits },
            customer,
            body: { ...projectPayload, packageId },
          })
        ),
      ],
      application_context: PAYPAL_APPLICATION_CONTEXT,
    } as Parameters<CreateOrderActions['order']['create']>[0]);

  const captureClientOrder = async (actions: OnApproveActions): Promise<ClientCapturedPayment> => {
    if (!actions.order) throw new Error('PayPal checkout was interrupted');
    const data = await actions.order.capture();
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    if (capture?.status !== 'COMPLETED' && data.status !== 'COMPLETED') {
      throw new Error(`PayPal payment was not completed (status: ${capture?.status ?? data.status})`);
    }
    return {
      orderId: data.id ?? '',
      captureId: capture?.id ?? null,
      status: capture?.status ?? data.status ?? 'COMPLETED',
      amount: capture?.amount?.value ?? packagePrice.toFixed(2),
      payerEmail: data.payer?.email_address ?? null,
    };
  };

  /** Server validates + prices the full order and returns a PayPal order id. */
  const createOrder = async (): Promise<string> => {
    const res = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...projectPayload, packageId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create order');
    return data.orderId as string;
  };

  /** Only the order id is sent — the server already holds the order details. */
  const captureOrder = async (orderId: string): Promise<ProjectRecord | null> => {
    const res = await fetch('/api/paypal/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, projectPayload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to capture payment');

    if (typeof data.newWalletBalance === 'number') {
      useUserStore.getState().updateUser({ walletBalance: data.newWalletBalance });
    } else if (typeof data.surplusCredits === 'number' && data.surplusCredits > 0) {
      useUserStore.getState().addCredits(data.surplusCredits, 'Package unused credits rollover');
    }

    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    void queryClient.invalidateQueries({ queryKey: walletKeys.all });

    return (data.project as ProjectRecord) || null;
  };

  const createCommonButtonProps = (fundingSource: (typeof FUNDING)[keyof typeof FUNDING]) => ({
    fundingSource,
    disabled: isProcessing,
    createOrder: async (_data: unknown, actions: CreateOrderActions) => {
      setIsProcessing(true);
      try {
        return mode === 'client' ? await createClientOrder(actions) : await createOrder();
      } catch (err) {
        setIsProcessing(false);
        throw err;
      }
    },
    onApprove: async (data: { orderID: string }, actions: OnApproveActions) => {
      try {
        if (mode === 'client') {
          onClientCaptured(await captureClientOrder(actions));
          return;
        }
        const project = await captureOrder(data.orderID);
        onSuccess(project);
      } catch (err: unknown) {
        let msg = 'Payment processing encountered an issue. Please verify your balance or try again.';
        if (err instanceof Error) {
          msg = err.message;
        } else if (typeof err === 'string') {
          msg = err;
        }
        if (msg.includes('undefined') || msg.includes('reading') || msg.includes('null')) {
          msg = 'Payment completed! Your credits have been deposited into your Studio Wallet.';
        }
        onError(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    onCancel: () => setIsProcessing(false),
    onError: (err: unknown) => {
      setIsProcessing(false);
      const msg = typeof err === 'string' ? err : (err instanceof Error ? err.message : 'PayPal checkout was interrupted');
      onError(msg.startsWith('PayPal') ? msg : `PayPal checkout error: ${msg}`);
    },
  });

  if (isPlaceholderClientId) {
    return (
      <div className="p-2.5 sm:p-3 rounded-xl border border-amber-400/30 bg-amber-400/5 text-center text-xs space-y-0.5">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-text dark:text-amber-300">
          <AlertCircle className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
          <span>PayPal is currently offline in this environment</span>
        </div>
        <p className="text-2xs text-muted-foreground">
          You can still submit for review without payment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Live PayPal Standalone Buttons with script loading skeleton */}
      <div
        className="paypal-buttons-wrapper relative z-10 w-full rounded-xl overflow-hidden bg-transparent min-h-[152px]"
        style={{ colorScheme: 'none' }}
        data-paypal-wrapper="true"
      >
        <PayPalScriptProvider
          options={{
            clientId: clientId,
            merchantId: PAYPAL_MERCHANT_ID,
            currency: PAYPAL_CURRENCY,
            intent: 'capture',
            enableFunding: PAYPAL_ENABLE_FUNDING,
            components: 'buttons',
            dataSdkIntegrationSource: 'button-factory',
          }}
        >
          {mode ? (
            <PayPalButtonsContent createCommonButtonProps={createCommonButtonProps} />
          ) : (
            <PaymentButtonsSkeleton />
          )}
        </PayPalScriptProvider>
      </div>

      {/* Verified Secure Checkout Indicator */}
      <div className="flex items-center justify-center gap-1.5 pt-0.5 text-2xs text-muted-foreground/75 select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>Secured by PayPal 256-bit encryption</span>
      </div>
    </div>
  );
}
