export interface KeysetCursor {
  createdAt: string;
  id: string;
}

export const PAGINATION_LIMITS = {
  CLIENT_DEFAULT: 20,
  CLIENT_MAX: 50,
  ADMIN_DEFAULT: 25,
  ADMIN_MAX: 100,
} as const;

/**
 * Encodes a keyset cursor { createdAt, id } into a URL-safe base64 string.
 */
export function encodeCursor(cursor: KeysetCursor): string {
  try {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  } catch {
    return '';
  }
}

/**
 * Decodes a URL-safe base64 string into a keyset cursor { createdAt, id }.
 */
export function decodeCursor(cursorStr?: string | null): KeysetCursor | null {
  if (!cursorStr || typeof cursorStr !== 'string') return null;
  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.createdAt === 'string' && typeof parsed.id === 'string') {
      return {
        createdAt: parsed.createdAt,
        id: parsed.id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Strictly clamps requested page size to prevent malicious or accidental huge queries.
 */
export function clampLimit(
  requested: number | string | undefined | null,
  fallback: number,
  maximum: number
): number {
  const num = typeof requested === 'string' ? parseInt(requested, 10) : Number(requested);
  if (isNaN(num) || num <= 0) return fallback;
  return Math.min(num, maximum);
}

/**
 * Normalizes an ISO timestamp string to 6-digit microsecond precision UTC format
 * (e.g. 2026-10-12T10:00:00.123456Z) so that string comparisons are chronologically exact
 * without truncation or rounding errors.
 */
export function normalizeTimestampToMicroseconds(ts: string): string {
  if (!ts || typeof ts !== 'string') return '';
  let s = ts.trim().replace(/\+00:00$/, 'Z').replace(/\+00$/, 'Z');
  const match = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z)?$/);
  if (!match) return s;
  const prefix = match[1];
  let frac = match[2] || '0';
  if (frac.length < 6) {
    frac = frac.padEnd(6, '0');
  } else if (frac.length > 6) {
    frac = frac.slice(0, 6);
  }
  return `${prefix}.${frac}Z`;
}

/**
 * Accurately compares two ISO timestamps preserving microsecond precision
 * without passing through JavaScript Date (which truncates to milliseconds).
 */
export function compareIsoTimestamps(a: string, b: string): number {
  if (a === b) return 0;
  const normA = normalizeTimestampToMicroseconds(a);
  const normB = normalizeTimestampToMicroseconds(b);
  return normA.localeCompare(normB);
}

/**
 * Sanitizes user-supplied search queries to prevent PostgREST syntax injection
 * and query manipulation (stripping commas, parens, quotes, operators, and wildcards).
 */
export function sanitizeSearchQuery(query?: string | null): string {
  if (!query || typeof query !== 'string') return '';
  // 1. Truncate to maximum 100 characters to prevent DOS / oversized URL attacks
  const truncated = query.slice(0, 100);
  // 2. Strip PostgREST syntax and delimiter characters: commas, parens, quotes, backslashes, semicolons
  // Replace with single space so keywords remain separated without syntax meaning
  return truncated
    .replace(/[(),."';\\/\[\]{}]/g, ' ')
    .replace(/[*%_]/g, ' ') // neutralize wildcards so user cannot force arbitrary table scans
    .replace(/\s+/g, ' ')
    .trim();
}
