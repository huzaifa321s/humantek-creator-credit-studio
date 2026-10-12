import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, DollarSign, Clock, RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

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
        bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
        icon: AlertTriangle,
      };
    }
    if (type.includes('DISPUTE') || type.includes('REVERSAL')) {
      return {
        bg: 'bg-amber-400/15 text-brand-text dark:text-amber-300 border-amber-400/30',
        icon: ShieldAlert,
      };
    }
    return {
      bg: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30',
      icon: DollarSign,
    };
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-card border border-border/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
              Security & Settlement Alerts
            </h3>
            <p className="text-xs text-muted-foreground">
              Audit log of chargebacks, refund shortfalls, price mismatches, and frozen wallets
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchAlerts}
          disabled={loading}
          loading={loading}
          className="cursor-pointer self-start sm:self-auto gap-1.5"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {/* Alerts list */}
      {loading && alerts.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-xs sm:text-sm">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <Empty className="p-10 sm:p-12 rounded-xl bg-card border border-border/80 text-center shadow-2xs">
          <EmptyMedia variant="default">
            <CheckCircle2 className="size-8 text-emerald-500" />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-semibold text-foreground">All Clear</EmptyTitle>
          <EmptyDescription className="text-xs text-muted-foreground max-w-sm mx-auto">
            No active shortfalls, disputes, or security alerts. All transactions and wallet settlements are in good standing.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((alert) => {
            const { bg, icon: Icon } = getBadgeStyle(alert.type);
            const isExpanded = expandedId === alert.id;

            return (
              <div
                key={alert.id}
                className="rounded-xl bg-card border border-border/80 hover:border-border transition-all overflow-hidden shadow-2xs"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  className="p-3.5 sm:p-4 flex items-start justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <Badge
                      variant="outline"
                      size="sm"
                      className={cn('gap-1.5 shrink-0 self-start font-medium', bg)}
                    >
                      <Icon className="size-3.5" />
                      {alert.type.replace(/_/g, ' ')}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-foreground font-medium leading-snug break-words">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-3 sm:gap-4 mt-2 text-2xs sm:text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {new Date(alert.created_at).toLocaleString()}
                        </span>
                        {alert.order_id && (
                          <span className="font-mono text-muted-foreground">
                            Order: {alert.order_id.slice(0, 8)}...
                          </span>
                        )}
                        {alert.user_id && (
                          <span className="font-mono text-muted-foreground">
                            User: {alert.user_id.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-muted-foreground shrink-0 mt-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && alert.metadata && Object.keys(alert.metadata).length > 0 && (
                  <div className="px-4 pb-4 pt-2 border-t border-border/60 bg-muted/20">
                    <div className="text-2xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                      Settlement Metadata
                    </div>
                    <pre className="p-3 rounded-lg bg-card border border-border/80 text-[11px] font-mono text-foreground overflow-x-auto">
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
