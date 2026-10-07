'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons, FUNDING } from '@paypal/react-paypal-js';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectRecord } from '@/types';
import { useUserStore } from '@/lib/userStore';
import { projectKeys } from '@/lib/queries/projects';
import { walletKeys } from '@/lib/queries/wallet';

interface PayPalButtonWrapperProps {
  packageId: string;
  packagePrice: number;
  projectPayload: Record<string, unknown>;
  onSuccess: (project: ProjectRecord) => void;
  onError: (msg: string) => void;
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
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb';
  const showSimulator = process.env.NODE_ENV !== 'production';

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
  const captureOrder = async (orderId: string): Promise<ProjectRecord> => {
    const res = await fetch('/api/paypal/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
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

    return data.project as ProjectRecord;
  };

  const handleSimulatePayment = async () => {
    setIsProcessing(true);
    try {
      const orderId = await createOrder();
      const project = await captureOrder(orderId);

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });

      onSuccess(project);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment error';
      onError(msg);
    } finally {
      setIsProcessing(false);
    }
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
        const msg = err instanceof Error ? err.message : 'Error capturing payment';
        onError(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    onCancel: () => setIsProcessing(false),
    onError: (err: unknown) => {
      setIsProcessing(false);
      onError(`PayPal checkout error: ${err}`);
    },
  });

  return (
    <div className="space-y-3">
      {/* Live PayPal Standalone Buttons — zero white frame, 100% vibrant authentic brand colors */}
      <div
        className="paypal-buttons-wrapper relative z-10 w-full rounded-xl overflow-hidden bg-transparent"
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
          <div className="space-y-2.5">
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
        </PayPalScriptProvider>
      </div>

      {/* Verified Secure Checkout Indicator */}
      <div className="flex items-center justify-center gap-1.5 pt-0.5 text-2xs text-muted-foreground/75 select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>Secured by PayPal 256-bit encryption</span>
      </div>

      {/* Discrete Sandbox Testing Action — dev builds only, never shipped to production */}
      {showSimulator && (
      <div className="pt-1 text-center">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          loading={isProcessing}
          loadingText="Processing simulation..."
          onClick={handleSimulatePayment}
          className="text-xs h-7 text-muted-foreground/70 hover:text-amber-600 dark:hover:text-amber-400 gap-1.5"
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Simulate Sandbox Payment (Dev Test)</span>
        </Button>
      </div>
      )}
    </div>
  );
}
