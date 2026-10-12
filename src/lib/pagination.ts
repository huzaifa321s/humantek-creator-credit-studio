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
