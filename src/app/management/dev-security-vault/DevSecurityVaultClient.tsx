'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Copy,
  Check,
  Download,
  Globe,
  Monitor,
  Clock,
  KeyRound,
  MailWarning,
  Users,
  Terminal,
  Activity,
  Lock,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LoginHistoryEntry {
  id: string;
  user_id: string | null;
  email: string;
  role: string;
  auth_method: string;
  ip_address: string;
  location: string | null;
  device: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ProfileLoginSnapshot {
  id: string;
  email: string;
  name: string | null;
  role: string;
  team_role: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_login_device: string | null;
  created_at: string;
}

interface SecurityDiagnostics {
  supabaseConfigured: boolean;
  smtpConfigured: boolean;
  smtpHost: string | null;
  developerAlertEmail: string;
  paypalMode: string;
  nodeEnv: string;
  serverTime: string;
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatExactTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAuthMethodBadge(method: string) {
  const clean = (method || 'password').toLowerCase();
  switch (clean) {
    case 'google_oauth':
      return { label: 'Google OAuth', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    case 'otp_code':
      return { label: 'Email OTP', className: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
    case 'magic_link':
      return { label: 'Magic Link', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
    case 'signup':
      return { label: 'New Signup', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'password':
    default:
      return { label: 'Password', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' };
  }
}

export function DevSecurityVaultClient() {
  const [entries, setEntries] = useState<LoginHistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<ProfileLoginSnapshot[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [maxCap, setMaxCap] = useState(500);
  const [diagnostics, setDiagnostics] = useState<SecurityDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);

  const [activeTab, setActiveTab] = useState<'history' | 'profiles' | 'diagnostics'>('history');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'client'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchVaultData = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await fetch('/api/system/login-history?limit=500', {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load security telemetry');
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
      setTotalCount(typeof data.total === 'number' ? data.total : (data.entries?.length || 0));
      setMaxCap(data.maxCap || 500);
      if (data.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
      if (silent) {
        toast.success('Security telemetry refreshed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not fetch security logs');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVaultData(false);
  }, [fetchVaultData]);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedToken((prev) => (prev === text ? null : prev));
    }, 2000);
  };

  const handleCopySecretVaultUrl = () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/management/dev-security-vault`
        : '/management/dev-security-vault';
    handleCopyText(url, 'Secret Developer Vault URL');
  };

  const handleSendTestErrorEmail = async () => {
    setIsSendingTestAlert(true);
    try {
      const res = await fetch('/api/system/login-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_error_alert' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch test error alert');
      }
      toast.success('Test Error Alert Dispatched', {
        description: data.message || `Sent to ${data.targetEmail}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test error alert');
    } finally {
      setIsSendingTestAlert(false);
    }
  };

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((item) => {
      if (roleFilter !== 'all' && (item.role || '').toLowerCase() !== roleFilter) {
        return false;
      }
      if (methodFilter !== 'all' && (item.auth_method || '').toLowerCase() !== methodFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (item.email || '').toLowerCase().includes(q) ||
        (item.ip_address || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q) ||
        (item.device || '').toLowerCase().includes(q) ||
        (item.user_id || '').toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, roleFilter, methodFilter]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== 'all' && (p.role || '').toLowerCase() !== roleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (p.email || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.last_login_ip || '').toLowerCase().includes(q) ||
        (p.last_login_device || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q)
      );
    });
  }, [profiles, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const uniqueIps = new Set(entries.map((e) => e.ip_address).filter(Boolean)).size;
    const uniqueUsers = new Set(entries.map((e) => e.email).filter(Boolean)).size;
    const adminLogins = entries.filter((e) => (e.role || '').toLowerCase() === 'admin').length;
    const clientLogins = entries.length - adminLogins;
    return { uniqueIps, uniqueUsers, adminLogins, clientLogins };
  }, [entries]);

  const handleExportCsv = () => {
    if (filteredEntries.length === 0) {
      toast.error('No login history rows to export');
      return;
    }
    const headers = [
      'Timestamp (ISO)',
      'Email',
      'Role',
      'Auth Method',
      'IP Address',
      'Location',
      'Device',
      'User ID',
      'User Agent',
    ];
    const escapeCsv = (val: string | null | undefined) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };
    const rows = filteredEntries.map((e) =>
      [
        escapeCsv(e.created_at),
        escapeCsv(e.email),
        escapeCsv(e.role),
        escapeCsv(e.auth_method),
        escapeCsv(e.ip_address),
        escapeCsv(e.location),
        escapeCsv(e.device),
        escapeCsv(e.user_id),
        escapeCsv(e.user_agent),
      ].join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `humantek-login-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredEntries.length} login audit rows to CSV`);
  };

  return (
    <div className="space-y-6">
      {/* Top Unlinked Developer Banner */}
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-400 shrink-0 mt-0.5">
            <Terminal className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Secret Developer Vault
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-400/30 text-amber-300 bg-amber-400/10">
                <Lock className="size-2.5 mr-1" />
                Unlinked Route · Admin Auth Required
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This route (<code className="text-foreground font-mono px-1.5 py-0.5 rounded bg-secondary/80">/management/dev-security-vault</code>) is intentionally hidden from all navigation menus. Share this direct URL only with authorized studio developers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopySecretVaultUrl}
            className="text-xs gap-1.5 cursor-pointer"
          >
            {copiedToken?.endsWith('/management/dev-security-vault') ? (
              <Check className="size-3.5 text-emerald-400" />
            ) : (
              <Copy className="size-3.5" />
            )}
            Copy Secret Link
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredEntries.length === 0}
            className="text-xs gap-1.5 cursor-pointer"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>

          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={() => fetchVaultData(true)}
            disabled={isRefreshing || isLoading}
            className="text-xs gap-1.5 font-semibold cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* 4 Telemetry Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Ring Buffer Storage</span>
              <Activity className="size-3.5 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {totalCount} <span className="text-sm font-normal text-muted-foreground">/ {maxCap} rows</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((totalCount / maxCap) * 100))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-prunes oldest rows beyond {maxCap} (zero DB bloat)
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Distinct IP Footprints</span>
              <Globe className="size-3.5 text-cyan-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {stats.uniqueIps} <span className="text-sm font-normal text-muted-foreground">unique IPs</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              Across <span className="text-foreground font-semibold">{stats.uniqueUsers}</span> distinct user accounts
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Role Breakdown</span>
              <Users className="size-3.5 text-emerald-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {stats.adminLogins} <span className="text-sm font-normal text-muted-foreground">Admin</span> ·{' '}
              {stats.clientLogins} <span className="text-sm font-normal text-muted-foreground">Client</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              <span className="text-foreground font-semibold">{profiles.length}</span> total registered profiles tracked
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Developer Error Alert Inbox</span>
              <MailWarning className="size-3.5 text-rose-400" />
            </CardDescription>
            <CardTitle className="text-sm font-mono font-bold truncate text-foreground pt-1">
              {diagnostics?.developerAlertEmail || 'dev.humantek@gmail.com'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">
              SMTP: {diagnostics?.smtpConfigured ? 'Connected' : 'Check Env'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendTestErrorEmail}
              disabled={isSendingTestAlert}
              className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer border-amber-400/30 hover:bg-amber-400/10"
            >
              <Send className="size-3 text-amber-400" />
              {isSendingTestAlert ? 'Sending...' : 'Test Alert'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs + Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="inline-flex items-center p-1 rounded-lg bg-secondary/70 border border-border/60 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-background text-foreground shadow-2xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Login Audit Stream ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profiles')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'profiles'
                ? 'bg-background text-foreground shadow-2xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Users Last-Login Snapshot ({profiles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-background text-foreground shadow-2xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Security Architecture & Diagnostics
          </button>
        </div>

        {activeTab !== 'diagnostics' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search email, IP, location, device..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background/60"
              />
            </div>

            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'client')}
              className="h-8 rounded-md border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-amber-400"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins Only</option>
              <option value="client">Clients Only</option>
            </select>

            {activeTab === 'history' && (
              <select
                aria-label="Filter by auth method"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="h-8 rounded-md border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-amber-400"
              >
                <option value="all">All Auth Methods</option>
                <option value="password">Password</option>
                <option value="google_oauth">Google OAuth</option>
                <option value="otp_code">Email OTP</option>
                <option value="magic_link">Magic Link</option>
                <option value="signup">New Signup</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: LOGIN HISTORY RING BUFFER */}
      {activeTab === 'history' && (
        <Card className="border-border/70 bg-card/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/70 bg-secondary/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User Account</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Auth Method</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Geo Location</th>
                  <th className="py-3 px-4">Device / Browser</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      Loading login security stream...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No login events match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => {
                    const isAdminRole = (entry.role || '').toLowerCase() === 'admin';
                    const methodBadge = formatAuthMethodBadge(entry.auth_method);
                    const isExpanded = expandedRowId === entry.id;

                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          onClick={() => setExpandedRowId(isExpanded ? null : entry.id)}
                          className="hover:bg-secondary/30 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <Clock className="size-3 text-muted-foreground shrink-0" />
                              {formatRelativeTime(entry.created_at)}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {formatExactTime(entry.created_at)}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground break-all">
                              {entry.email}
                            </div>
                            {entry.user_id && (
                              <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">
                                ID: {entry.user_id.slice(0, 8)}…
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {isAdminRole ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30">
                                <ShieldCheck className="size-3" />
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-secondary text-muted-foreground border border-border">
                                Client
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${methodBadge.className}`}
                            >
                              <KeyRound className="size-2.5" />
                              {methodBadge.label}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-secondary/70 px-2 py-1 rounded border border-border/70">
                              <span>{entry.ip_address || 'unknown'}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(entry.ip_address || '', 'IP address');
                                }}
                                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                title="Copy IP Address"
                              >
                                {copiedToken === entry.ip_address ? (
                                  <Check className="size-3 text-emerald-400" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Globe className="size-3.5 text-muted-foreground/70 shrink-0" />
                              <span>{entry.location || 'Unknown'}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              <div className="inline-flex items-center gap-1.5 text-foreground">
                                <Monitor className="size-3.5 text-muted-foreground shrink-0" />
                                <span>{entry.device || 'Unknown Device'}</span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="size-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="size-3.5 text-muted-foreground" />
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-secondary/20">
                            <td colSpan={7} className="px-4 py-3 text-[11px] text-muted-foreground">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <span className="font-semibold text-foreground">Raw User-Agent: </span>
                                  <code className="font-mono break-all text-muted-foreground">
                                    {entry.user_agent || 'Not recorded'}
                                  </code>
                                </div>
                                {entry.user_id && (
                                  <div className="shrink-0 font-mono">
                                    Full User UUID: <span className="text-foreground">{entry.user_id}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: PROFILES LAST LOGIN SNAPSHOT */}
      {activeTab === 'profiles' && (
        <Card className="border-border/70 bg-card/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/70 bg-secondary/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">User / Email</th>
                  <th className="py-3 px-4">System Role</th>
                  <th className="py-3 px-4">Last Login Time</th>
                  <th className="py-3 px-4">Last Known IP</th>
                  <th className="py-3 px-4">Last Known Device</th>
                  <th className="py-3 px-4">Account Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No user profiles match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((prof) => {
                    const isAdmin = (prof.role || '').toLowerCase() === 'admin';
                    return (
                      <tr key={prof.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">
                            {prof.name || prof.email.split('@')[0]}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{prof.email}</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30">
                              Admin {prof.team_role ? `· ${prof.team_role}` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-secondary text-muted-foreground border border-border">
                              Client
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {prof.last_login_at ? (
                            <>
                              <div className="font-semibold text-foreground">
                                {formatRelativeTime(prof.last_login_at)}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {formatExactTime(prof.last_login_at)}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground/60 italic">No recorded login yet</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-mono">
                          {prof.last_login_ip ? (
                            <span className="bg-secondary/70 px-2 py-0.5 rounded border border-border/70">
                              {prof.last_login_ip}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {prof.last_login_device || <span className="text-muted-foreground/50">—</span>}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                          {formatExactTime(prof.created_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: SECURITY ARCHITECTURE & DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="size-4 text-amber-400" />
                Developer Error Alerting Pipeline
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time backend & client crash reports with client email context
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Target Developer Inbox</span>
                <span className="font-mono font-semibold text-foreground">
                  {diagnostics?.developerAlertEmail || 'dev.humantek@gmail.com'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">SMTP Transport</span>
                <span className="font-mono text-foreground">
                  {diagnostics?.smtpConfigured
                    ? `Active (${diagnostics.smtpHost})`
                    : 'Not Configured'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Rate-Limit & Cooldown Protection</span>
                <span className="text-foreground font-medium">5m per signature · Max 20 / 10m</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Monitored Pipelines</span>
                <span className="text-foreground font-medium">
                  Projects, PayPal, Wallet, Uploads, Chat, UI Error Boundaries
                </span>
              </div>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  onClick={handleSendTestErrorEmail}
                  disabled={isSendingTestAlert}
                  className="w-full text-xs font-semibold gap-2 cursor-pointer"
                >
                  <Send className="size-3.5" />
                  {isSendingTestAlert
                    ? 'Dispatching Test Error Email...'
                    : `Send Live Test Error Email to ${diagnostics?.developerAlertEmail || 'dev.humantek@gmail.com'}`}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-400" />
                Zero-Bloat Login Audit Ring Buffer
              </CardTitle>
              <CardDescription className="text-xs">
                PostgreSQL trigger-enforced 500-row cap for free-tier database protection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Database Table</span>
                <code className="font-mono text-foreground">public.login_history</code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Auto-Prune Trigger</span>
                <code className="font-mono text-emerald-400">trg_prune_login_history (Max 500)</code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Tracked Auth Flows</span>
                <span className="text-foreground font-medium">
                  Password, Google OAuth, OTP Code, Magic Link, Signup
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Environment / PayPal Mode</span>
                <span className="font-mono text-foreground uppercase">
                  {diagnostics?.nodeEnv || 'production'} · PayPal {diagnostics?.paypalMode || 'sandbox'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Server Timestamp</span>
                <span className="font-mono text-muted-foreground">
                  {formatExactTime(diagnostics?.serverTime)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
