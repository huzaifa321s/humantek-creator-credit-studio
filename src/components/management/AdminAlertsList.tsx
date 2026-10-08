'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, DollarSign, Clock, RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export interface AdminAlert {
  id: string;
  user_id: string | null;
  order_id: string | null;
  type: string;
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface AdminAlertsListProps {
  onAlertCountChange?: (count: number) => void;
}

export function AdminAlertsList({ onAlertCountChange }: AdminAlertsListProps) {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/management/alerts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.alerts || [];
      setAlerts(list);
      onAlertCountChange?.(list.length);
    } catch (err: any) {
      console.error('Failed to load admin alerts:', err);
      toast.error('Could not load security alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const getBadgeStyle = (type: string) => {
    if (type.includes('SHORTFALL') || type.includes('PRICE_MISMATCH')) {
      return {
        bg: 'bg-red-500/10 text-red-400 border-red-500/20',
        icon: AlertTriangle,
      };
    }
    if (type.includes('DISPUTE') || type.includes('REVERSAL')) {
      return {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: ShieldAlert,
      };
    }
    return {
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      icon: DollarSign,
    };
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Security & Settlement Alerts
            </h3>
            <p className="text-xs text-slate-400">
              Audit log of chargebacks, refund shortfalls, price mismatches, and frozen wallets
            </p>
          </div>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alerts list */}
      {loading && alerts.length === 0 ? (
        <div className="p-12 text-center text-slate-400">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="p-12 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="text-sm font-medium text-white">All Clear</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No active shortfalls, disputes, or security alerts. All transactions and wallet settlements are in good standing.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((alert) => {
            const { bg, icon: Icon } = getBadgeStyle(alert.type);
            const isExpanded = expandedId === alert.id;

            return (
              <div
                key={alert.id}
                className="rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all overflow-hidden"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  className="p-4 flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${bg} shrink-0`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {alert.type.replace(/_/g, ' ')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 font-medium leading-snug break-words">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(alert.created_at).toLocaleString()}
                        </span>
                        {alert.order_id && (
                          <span className="font-mono text-slate-500">
                            Order: {alert.order_id.slice(0, 8)}...
                          </span>
                        )}
                        {alert.user_id && (
                          <span className="font-mono text-slate-500">
                            User: {alert.user_id.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-slate-500 shrink-0 mt-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && alert.metadata && Object.keys(alert.metadata).length > 0 && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-800/60 bg-slate-950/40">
                    <div className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Settlement Metadata
                    </div>
                    <pre className="p-3 rounded-lg bg-black/60 border border-slate-800 text-[11px] font-mono text-cyan-300/90 overflow-x-auto">
                      {JSON.stringify(alert.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
