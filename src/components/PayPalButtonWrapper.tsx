'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import confetti from 'canvas-confetti';
import { Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { ProjectRecord } from '@/types';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb';

  const handleSimulatePayment = async () => {
    setIsProcessing(true);
    try {
      // 1. Create order
      const createRes = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, projectId: projectPayload.projectId }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create order');

      // 2. Capture order
      const captureRes = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createData.orderId,
          projectData: projectPayload,
        }),
      });
      const captureData = await captureRes.json();
      if (!captureRes.ok) throw new Error(captureData.error || 'Failed to capture payment');

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });

      onSuccess(captureData.project);
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
              const res = await fetch('/api/paypal/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  packageId,
                  projectId: projectPayload.projectId,
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                setIsProcessing(false);
                throw new Error(data.error);
              }
              return data.orderId;
            }}
            onApprove={async (data) => {
              try {
                const res = await fetch('/api/paypal/capture-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: data.orderID,
                    projectData: projectPayload,
                  }),
                });
                const resData = await res.json();
                if (!res.ok) throw new Error(resData.error);

                confetti({
                  particleCount: 120,
                  spread: 80,
                  origin: { y: 0.6 },
                });

                onSuccess(resData.project);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Error capturing payment';
                onError(msg);
              } finally {
                setIsProcessing(false);
              }
            }}
            onError={(err) => {
              setIsProcessing(false);
              onError(`PayPal checkout error: ${err}`);
            }}
          />
        </PayPalScriptProvider>
      </div>

      {/* Discrete Sandbox Testing Action (Avoids competing with real checkout) */}
      <div className="pt-1 text-center">
        <button
          type="button"
          disabled={isProcessing}
          onClick={handleSimulatePayment}
          className="text-[11px] text-muted-foreground/70 hover:text-amber-600 dark:hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 select-none py-1 px-2 rounded-md hover:bg-secondary/30"
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
        </button>
      </div>
    </div>
  );
}
