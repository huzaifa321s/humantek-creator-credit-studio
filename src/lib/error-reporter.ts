import 'server-only';
import { buildDeveloperErrorEmailTemplate, sendStudioEmail } from '@/lib/email';

const DEFAULT_DEVELOPER_ALERT_EMAIL = 'dev.humantek@gmail.com';
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes per unique error signature
const GLOBAL_BURST_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const GLOBAL_BURST_MAX = 20;

interface DedupEntry {
  lastSentAt: number;
  suppressedCount: number;
}

const errorDedupMap = new Map<string, DedupEntry>();
let globalWindowStart = Date.now();
let globalSentCount = 0;

const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|cookie|authorization|api_key|apikey|service_role|smtp_pass|private_key/i;

function sanitizeContextValue(val: unknown, depth = 0): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val.slice(0, 600);
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (depth > 2) return '[Object]';
  try {
    const scrubbed = JSON.stringify(
      val,
      (key, value) => {
        if (key && SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]';
        if (typeof value === 'string' && value.length > 500) {
          return `${value.slice(0, 500)}…`;
        }
        return value;
      },
      2
    );
    return (scrubbed || '—').slice(0, 1500);
  } catch {
    return String(val).slice(0, 600);
  }
}

export function getDeveloperAlertEmail(): string {
  const configured = (process.env.DEVELOPER_ALERT_EMAIL || '').trim();
  if (configured && configured.includes('@')) {
    return configured;
  }
  return DEFAULT_DEVELOPER_ALERT_EMAIL;
}

export interface StudioErrorUserContext {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface ReportStudioErrorParams {
  /** High-level area or endpoint, e.g. 'POST /api/projects' or 'Client UI Crash' */
  area: string;
  /** Route or page URL where the error occurred */
  route?: string;
  /** Error instance, Supabase error object, or message string */
  error: unknown;
  /** Affected client / user (if authenticated or known from payload) */
  user?: StudioErrorUserContext | null;
  /** Fallback client email if user is not resolved from session */
  clientEmail?: string | null;
  /** Fallback client name if user is not resolved from session */
  clientName?: string | null;
  /** Severity label */
  severity?: 'CRITICAL' | 'ERROR' | 'WARNING';
  /** Additional key-value metadata (projectCode, orderId, packageId, etc.) */
  context?: Record<string, unknown>;
}

function extractErrorDetails(err: unknown): {
  message: string;
  code?: string;
  stack?: string;
} {
  if (!err) {
    return { message: 'Unknown studio error' };
  }
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: string; digest?: string };
    return {
      message: err.message || err.name || 'Error',
      code: anyErr.code || anyErr.digest,
      stack: err.stack,
    };
  }
  if (typeof err === 'string') {
    return { message: err };
  }
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const msgParts = [
      typeof obj.message === 'string' ? obj.message : '',
      typeof obj.details === 'string' ? obj.details : '',
      typeof obj.hint === 'string' ? `Hint: ${obj.hint}` : '',
    ].filter(Boolean);
    const code =
      typeof obj.code === 'string' || typeof obj.code === 'number'
        ? String(obj.code)
        : undefined;
    const stack = typeof obj.stack === 'string' ? obj.stack : undefined;
    return {
      message: msgParts.join(' | ') || sanitizeContextValue(obj),
      code,
      stack,
    };
  }
  return { message: String(err) };
}

/**
 * Reports an unexpected backend, payment, database, or client UI error to the
 * developer email (`dev.humantek@gmail.com`) with client context and rate-limit protection.
 * Never throws so caller error responses are never interrupted.
 */
export async function reportStudioError(params: ReportStudioErrorParams): Promise<void> {
  try {
    const developerEmail = getDeveloperAlertEmail();
    const { message, code, stack } = extractErrorDetails(params.error);

    const resolvedEmail =
      (params.user?.email || params.clientEmail || '').trim().toLowerCase() || null;
    const resolvedName =
      (params.user?.name || params.clientName || '').trim() ||
      (resolvedEmail ? resolvedEmail.split('@')[0] : null);
    const resolvedUserId = (params.user?.id || '').trim() || null;
    const resolvedRole = (params.user?.role || '').trim() || (resolvedEmail ? 'client' : 'guest');

    const now = Date.now();

    // Global burst guard
    if (now - globalWindowStart > GLOBAL_BURST_WINDOW_MS) {
      globalWindowStart = now;
      globalSentCount = 0;
    }
    if (globalSentCount >= GLOBAL_BURST_MAX) {
      console.warn('[ErrorReporter] Global burst limit reached, suppressing developer alert email.');
      return;
    }

    // Per-signature cooldown guard
    const signature = `${params.area}|${resolvedEmail || 'guest'}|${code || ''}|${message.slice(0, 140)}`;
    const existing = errorDedupMap.get(signature);
    if (existing && now - existing.lastSentAt < DEDUP_WINDOW_MS) {
      existing.suppressedCount += 1;
      return;
    }

    const suppressedDuplicates = existing?.suppressedCount || 0;
    errorDedupMap.set(signature, { lastSentAt: now, suppressedCount: 0 });
    globalSentCount += 1;

    const contextRows: Array<[string, string]> = [];
    if (params.context) {
      for (const [rawKey, rawVal] of Object.entries(params.context)) {
        if (rawVal === undefined || rawVal === null || rawVal === '') continue;
        if (SENSITIVE_KEY_PATTERN.test(rawKey)) continue;
        const label = rawKey
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        contextRows.push([label, sanitizeContextValue(rawVal)]);
      }
    }

    if (suppressedDuplicates > 0) {
      contextRows.push([
        'Suppressed Repeats',
        `${suppressedDuplicates} identical error(s) in the last 5 minutes`,
      ]);
    }

    const emailPayload = buildDeveloperErrorEmailTemplate({
      to: developerEmail,
      area: params.area,
      route: params.route || params.area,
      severity: params.severity || 'ERROR',
      errorMessage: message,
      errorCode: code,
      stackTrace: stack,
      clientEmail: resolvedEmail,
      clientName: resolvedName,
      userId: resolvedUserId,
      userRole: resolvedRole,
      contextRows,
      occurredAt: new Date(now).toISOString(),
    });

    await sendStudioEmail(emailPayload);
  } catch (internalErr) {
    console.warn('[ErrorReporter] Failed to dispatch developer error alert:', internalErr);
  }
}
