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
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Manual Bank / Wire & Payoneer Orders
            </h3>
            <p className="text-xs text-slate-400">
              Audit and confirm manual deposits for early clients before third-party gateway cutover
            </p>
          </div>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Pending Manual Transfers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pending Confirmation ({pendingOrders.length})
          </h4>
        </div>

        {loading && orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading orders...</div>
        ) : pendingOrders.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
            <p className="text-xs text-slate-300 font-medium">No pending wire deposits</p>
            <p className="text-2xs text-slate-500">All client manual orders have been verified and settled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingOrders.map((order) => {
              const isConfirming = confirmingId === order.id;

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          HT-MANUAL-{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <Badge variant="outline" className="text-2xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Awaiting Bank Wire
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        Client: <span className="font-semibold text-white">{order.profiles?.email || order.user_id}</span>
                      </div>
                      <div className="text-2xs text-slate-500 mt-0.5">
                        Initiated {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">
                          ${(order.expected_amount_cents / 100).toFixed(2)} {order.currency}
                        </div>
                        <div className="text-xs text-cyan-400 font-mono">
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
                          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs cursor-pointer"
                        >
                          Verify & Deposit
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* Confirmation Inline Form */}
                  {isConfirming && (
                    <div className="p-4 rounded-lg bg-slate-950/60 border border-cyan-500/30 space-y-3 animate-in fade-in duration-150">
                      <div className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5" />
                        <span>Confirm Bank Transfer Settlement</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-2xs font-semibold text-slate-400 uppercase block mb-1">
                            Bank Reference / Transaction ID *
                          </label>
                          <Input
                            placeholder="e.g. MEZN-1092842 or PAYONEER-8392"
                            value={bankRef}
                            onChange={(e) => setBankRef(e.target.value)}
                            className="h-8 text-xs bg-black/40 border-slate-700 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-2xs font-semibold text-slate-400 uppercase block mb-1">
                            Admin Notes (Optional)
                          </label>
                          <Input
                            placeholder="e.g. Received via Meezan corporate account"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-8 text-xs bg-black/40 border-slate-700 text-white"
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
                          className="h-7 text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={submitting || !bankRef.trim()}
                          onClick={() => handleConfirm(order)}
                          className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
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
        <div className="space-y-3 pt-4 border-t border-slate-800/60">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Confirmed Wire Settlements ({fulfilledOrders.length})
          </h4>
          <div className="space-y-2">
            {fulfilledOrders.slice(0, 10).map((o) => (
              <div
                key={o.id}
                className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/60 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono text-cyan-400 font-medium mr-2">
                    HT-MANUAL-{o.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-slate-400">{o.profiles?.email}</span>
                  <span className="text-slate-500 ml-2">
                    (Ref: {o.provider_capture_id || 'Confirmed'})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-mono font-medium">+{o.credits_to_grant} CR</span>
                  <Badge variant="outline" className="text-2xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
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
