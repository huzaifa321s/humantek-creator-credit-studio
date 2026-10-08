'use client';

import { useState, useEffect } from 'react';
import { Landmark, CheckCircle2, Clock, RefreshCw, AlertCircle, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CreditValue } from '@/components/ui/credit-value';

export interface AdminOrder {
  id: string;
  user_id: string;
  provider: string;
  package_id: string;
  credits_to_grant: number;
  expected_amount_cents: number;
  captured_amount_cents: number | null;
  currency: string;
  status: string;
  provider_order_id: string | null;
  provider_capture_id: string | null;
  created_at: string;
  fulfilled_at: string | null;
  profiles?: { email: string; full_name?: string };
  packages?: { name: string };
}

export function AdminManualOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [bankRef, setBankRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/management/orders');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      toast.error('Could not load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleConfirm = async (order: AdminOrder) => {
    if (!bankRef.trim()) {
      toast.error('Please enter the bank wire or Payoneer reference');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/management/orders/confirm-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          bankReference: bankRef.trim(),
          amountCents: order.expected_amount_cents,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Confirmation failed');
      }

      toast.success(`Payment confirmed! ${order.credits_to_grant} CR granted to client.`);
      setConfirmingId(null);
      setBankRef('');
      setNotes('');
      fetchOrders();
    } catch (err: any) {
      console.error('Confirmation error:', err);
      toast.error(err.message || 'Failed to confirm payment');
    } finally {
      setSubmitting(false);
    }
  };

  const manualOrders = orders.filter((o) => o.provider === 'manual');
  const pendingOrders = manualOrders.filter((o) => o.status === 'created' || o.status === 'approved');
  const fulfilledOrders = manualOrders.filter((o) => o.status === 'fulfilled');

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-card border border-border/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
              Manual Bank / Wire & Payoneer Orders
            </h3>
            <p className="text-xs text-muted-foreground">
              Audit and confirm manual deposits for early clients before third-party gateway cutover
            </p>
          </div>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground bg-secondary/70 hover:bg-secondary border border-border/80 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Pending Manual Transfers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending Confirmation ({pendingOrders.length})
          </h4>
        </div>

        {loading && orders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs sm:text-sm">Loading orders...</div>
        ) : pendingOrders.length === 0 ? (
          <div className="p-8 rounded-xl bg-card border border-border/80 text-center space-y-2 shadow-2xs">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
            <p className="text-xs text-foreground font-medium">No pending wire deposits</p>
            <p className="text-2xs text-muted-foreground">All client manual orders have been verified and settled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingOrders.map((order) => {
              const isConfirming = confirmingId === order.id;

              return (
                <div
                  key={order.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/80 hover:border-border transition-all space-y-3 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                          HT-MANUAL-{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <Badge variant="outline" className="text-2xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          Awaiting Bank Wire
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 break-words">
                        Client: <span className="font-semibold text-foreground">{order.profiles?.email || order.user_id}</span>
                      </div>
                      <div className="text-2xs text-muted-foreground mt-0.5">
                        Initiated {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-border/40 sm:border-t-0 shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-semibold text-foreground">
                          ${(order.expected_amount_cents / 100).toFixed(2)} {order.currency}
                        </div>
                        <div className="text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">
                          +{order.credits_to_grant} CR
                        </div>
                      </div>

                      {!isConfirming ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setConfirmingId(order.id);
                            setBankRef(`WIRE-${order.id.slice(0, 6).toUpperCase()}`);
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs cursor-pointer shadow-xs"
                        >
                          Verify & Deposit
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* Confirmation Inline Form */}
                  {isConfirming && (
                    <div className="p-3.5 sm:p-4 rounded-lg bg-secondary/30 border border-amber-500/30 space-y-3 animate-in fade-in duration-150">
                      <div className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5" />
                        <span>Confirm Bank Transfer Settlement</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-2xs font-semibold text-muted-foreground uppercase block mb-1">
                            Bank Reference / Transaction ID *
                          </label>
                          <Input
                            placeholder="e.g. MEZN-1092842 or PAYONEER-8392"
                            value={bankRef}
                            onChange={(e) => setBankRef(e.target.value)}
                            className="h-8 text-xs bg-card border-border/80 text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-2xs font-semibold text-muted-foreground uppercase block mb-1">
                            Admin Notes (Optional)
                          </label>
                          <Input
                            placeholder="e.g. Received via corporate account"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-8 text-xs bg-card border-border/80 text-foreground"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={submitting}
                          onClick={() => setConfirmingId(null)}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={submitting || !bankRef.trim()}
                          onClick={() => handleConfirm(order)}
                          className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
                        >
                          {submitting ? 'Confirming...' : 'Grant Credits & Settle Order'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmed Orders History */}
      {fulfilledOrders.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border/70">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Confirmed Wire Settlements ({fulfilledOrders.length})
          </h4>
          <div className="space-y-2">
            {fulfilledOrders.slice(0, 10).map((o) => (
              <div
                key={o.id}
                className="p-3 rounded-lg bg-card border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs"
              >
                <div className="min-w-0">
                  <span className="font-mono text-amber-700 dark:text-amber-400 font-medium mr-2">
                    HT-MANUAL-{o.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-muted-foreground break-all">{o.profiles?.email}</span>
                  <span className="text-muted-foreground ml-2">
                    (Ref: {o.provider_capture_id || 'Confirmed'})
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">+{o.credits_to_grant} CR</span>
                  <Badge variant="outline" className="text-2xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    Settled
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
