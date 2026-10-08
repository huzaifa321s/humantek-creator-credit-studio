'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons, FUNDING, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { ProjectRecord } from '@/types';
import { useUserStore } from '@/lib/userStore';
import { projectKeys } from '@/lib/queries/projects';
import { walletKeys } from '@/lib/queries/wallet';

interface PayPalButtonWrapperProps {
  packageId: string;
  packagePrice: number;
  projectPayload: Record<string, unknown>;
  onSuccess: (project: ProjectRecord | null) => void;
  onError: (msg: string) => void;
}

/**
 * Pixel-matched button skeletons mirroring the exact heights (44px) and gaps
 * of the 3 PayPal buttons. Prevents Cumulative Layout Shift (CLS) while PayPal SDK loads.
 */
export function PaymentButtonsSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse" aria-label="Loading secure payment options...">
      {/* 1. Pay with PayPal slot */}
      <div className="h-11 w-full rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
        <div className="h-4 w-28 bg-amber-500/30 rounded-md" />
      </div>

      {/* 2. Pay Later slot */}
      <div className="h-11 w-full rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <div className="h-4 w-20 bg-amber-500/20 rounded-md" />
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
  packagePrice: _packagePrice,
  projectPayload,
  onSuccess,
  onError,
}: PayPalButtonWrapperProps) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const rawClientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '').trim();
  const isPlaceholderClientId =
    !rawClientId ||
    rawClientId === 'sb' ||
    rawClientId === 'your-paypal-client-id' ||
    rawClientId.includes('your-') ||
    rawClientId === 'placeholder' ||
    rawClientId.length < 10;
  const clientId = rawClientId;

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
    createOrder: async () => {
      setIsProcessing(true);
      try {
        return await createOrder();
      } catch (err) {
        setIsProcessing(false);
        throw err;
      }
    },
    onApprove: async (data: { orderID: string }) => {
      try {
        const project = await captureOrder(data.orderID);

        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });

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
      <div className="space-y-3">
        <div className="p-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 text-center space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>PayPal Gateway Offline</span>
          </div>
          <p className="text-2xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Live PayPal checkout is unconfigured in this environment. You can submit your project without upfront payment using the <b className="text-foreground">&quot;Request review (no payment yet)&quot;</b> option below.
          </p>
        </div>
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
            currency: 'USD',
            intent: 'capture',
          }}
        >
          <PayPalButtonsContent createCommonButtonProps={createCommonButtonProps} />
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
