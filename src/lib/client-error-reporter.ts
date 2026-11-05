'use client';

const reportedClientSignatures = new Set<string>();
const CHUNK_RELOAD_STORAGE_KEY = 'ht_chunk_reload_ts';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export interface ReportClientErrorOptions {
  area: string;
  error: unknown;
  route?: string;
  clientEmail?: string | null;
  clientName?: string | null;
  severity?: 'CRITICAL' | 'ERROR' | 'WARNING';
  context?: Record<string, unknown>;
}

/**
 * Detects Next.js / Webpack stale-deployment or mobile network drop chunk errors.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const errObj = error as { name?: string; message?: string };
  const name = typeof errObj?.name === 'string' ? errObj.name : '';
  const message =
    typeof errObj?.message === 'string'
      ? errObj.message
      : typeof error === 'string'
        ? error
        : '';

  if (name === 'ChunkLoadError') return true;
  return /Loading chunk [\w-]+ failed|Loading CSS chunk [\w-]+ failed|Failed to fetch dynamically imported module|ChunkLoadError/i.test(
    message
  );
}

/**
 * Attempts a single automatic hard reload when a visitor hits a stale JS chunk
 * after a new deployment or brief mobile network drop.
 * Returns `true` if a reload was triggered (caller should skip reporting the error).
 */
export function tryRecoverFromChunkError(error: unknown): boolean {
  if (typeof window === 'undefined') return false;
  if (!isChunkLoadError(error)) return false;

  try {
    const now = Date.now();
    const lastReloadRaw = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
    const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0;

    if (!lastReload || Number.isNaN(lastReload) || now - lastReload > CHUNK_RELOAD_COOLDOWN_MS) {
      window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
      window.location.reload();
      return true;
    }
  } catch {
    // If sessionStorage is blocked (e.g. strict private mode), fall through
  }

  return false;
}

export function reportClientError(opts: ReportClientErrorOptions): void {
  if (typeof window === 'undefined') return;
  try {
    // If this is a first-time ChunkLoadError, auto-reload silently instead of sending a false-alarm email
    if (tryRecoverFromChunkError(opts.error)) {
      return;
    }

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
        severity: isChunkLoadError(opts.error) ? 'WARNING' : (opts.severity || 'ERROR'),
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
