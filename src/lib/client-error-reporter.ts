'use client';

const reportedClientSignatures = new Set<string>();

export interface ReportClientErrorOptions {
  area: string;
  error: unknown;
  route?: string;
  clientEmail?: string | null;
  clientName?: string | null;
  severity?: 'CRITICAL' | 'ERROR' | 'WARNING';
  context?: Record<string, unknown>;
}

export function reportClientError(opts: ReportClientErrorOptions): void {
  if (typeof window === 'undefined') return;
  try {
    const errObj = opts.error as (Error & { digest?: string }) | undefined;
    const message =
      errObj instanceof Error
        ? errObj.message || errObj.name
        : typeof opts.error === 'string'
          ? opts.error
          : JSON.stringify(opts.error || 'Unknown client error');
    const stack = errObj instanceof Error ? errObj.stack : undefined;
    const digest = errObj && typeof errObj === 'object' && 'digest' in errObj ? errObj.digest : undefined;
    const route = opts.route || `${window.location.pathname}${window.location.search}`;

    const signature = `${opts.area}|${route}|${message.slice(0, 120)}`;
    if (reportedClientSignatures.has(signature)) return;
    reportedClientSignatures.add(signature);

    void fetch('/api/system/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area: opts.area,
        route,
        severity: opts.severity || 'ERROR',
        message,
        stack,
        digest,
        clientEmail: opts.clientEmail || undefined,
        clientName: opts.clientName || undefined,
        context: opts.context,
      }),
      keepalive: true,
    }).catch(() => {
      // Never throw on error telemetry
    });
  } catch {
    // Ignore client telemetry failure
  }
}
