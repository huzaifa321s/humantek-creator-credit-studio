'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Loader2, Sparkles, ShieldCheck } from 'lucide-react';
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

  return (
    <div className="space-y-3">
      {/* Live PayPal Smart Buttons */}
      <div className="relative z-10 w-full min-h-[44px]">
        <PayPalScriptProvider
          options={{
            clientId: clientId,
            currency: 'USD',
            intent: 'capture',
          }}
        >
          <PayPalButtons
            style={{
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'pay',
              height: 44,
            }}
            disabled={isProcessing}
            createOrder={async () => {
              setIsProcessing(true);
              try {
                return await createOrder();
              } catch (err) {
                setIsProcessing(false);
                throw err;
              }
            }}
            onApprove={async (data) => {
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
            }}
            onCancel={() => setIsProcessing(false)}
            onError={(err) => {
              setIsProcessing(false);
              onError(`PayPal checkout error: ${err}`);
            }}
          />
        </PayPalScriptProvider>
      </div>

      {/* Discrete Sandbox Testing Action — dev builds only, never shipped to production */}
      {showSimulator && (
      <div className="pt-1 text-center">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={isProcessing}
          onClick={handleSimulatePayment}
          className="text-xs h-7 text-muted-foreground/70 hover:text-amber-600 dark:hover:text-amber-400 gap-1.5"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
              <span>Processing simulation...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Simulate Sandbox Payment (Dev Test)</span>
            </>
          )}
        </Button>
      </div>
      )}
    </div>
  );
}
