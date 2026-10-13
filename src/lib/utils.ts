import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Safely extract a readable message from an unknown thrown value. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "string" && err) return err
  return fallback
}

export function formatStudioDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return ''
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatStudioRelativeTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return ''
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  const now = Date.now()
  const diffMs = now - d.getTime()
  if (diffMs < 0) return 'Just now'
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Safely formats any date/time string or timestamp for chat message displays.
 * Defends against `null`, `undefined`, `"Invalid Date"`, ISO timestamps, and relative strings.
 * Guarantees a valid, cleanly formatted time string like "09:15 AM".
 */
export function formatChatTimestamp(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const trimmed = raw.trim();
  if (
    trimmed === 'Invalid Date' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === 'NaN' ||
    !trimmed
  ) {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Remove "Today at " or "Yesterday at " prefix if present
  if (trimmed.startsWith('Today at ') || trimmed.startsWith('Yesterday at ')) {
    return trimmed.replace(/^(Today|Yesterday) at\s+/, '');
  }

  // If already formatted like "09:15 AM" or "14:30"
  if (/^\d{1,2}:\d{2}(:\d{2})?(\s*[APap][Mm])?$/.test(trimmed)) {
    return trimmed;
  }

  // Parse as Date (handles ISO 8601 strings from Postgres like 2026-10-08T08:30:00Z)
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  payment_confirmed: 'Payment Confirmed',
  in_production: 'In Production',
  review_round: 'Review Round',
  delivered: 'Delivered',
  declined: 'Declined',
}

export function getProjectStatusLabel(status?: string): string {
  if (!status) return 'Unknown'
  return PROJECT_STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded',
  pending: 'Pending',
}

export function getPaymentStatusLabel(status?: string): string {
  if (!status) return 'Unknown'
  return PAYMENT_STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  package_purchase: 'Package Purchase',
  service_deduction: 'Service Scope',
  promo_credit: 'Promo Code',
  refund: 'Refund',
}

export function getTransactionTypeLabel(type?: string): string {
  if (!type) return 'Unknown'
  return TRANSACTION_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Validates a redirect URL to guarantee it is a safe relative internal route.
 * Defends against open-redirect attacks including scheme injection, backslash tricks,
 * protocol-relative URLs, and whitespace/control-character bypasses (e.g. `/%09/evil.com`, `//\evil.com`, `\n`).
 */
export function getSafeRedirectUrl(
  nextParam: string | null | undefined,
  fallback = '/projects'
): string {
  if (!nextParam || typeof nextParam !== 'string') return fallback;

  let decoded = nextParam.trim();
  // Decode iterative percent-encoding to catch multi-layered bypasses (%252f etc.)
  for (let i = 0; i < 3; i++) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      break;
    }
  }

  // Reject any string containing control characters (ASCII 0-31, including \r, \n, \t, \0)
  if (/[\x00-\x1F\x7F]/.test(decoded)) {
    return fallback;
  }

  // Reject backslashes anywhere, colons anywhere (schemes, data:, javascript:), protocol relative
  if (
    decoded.includes('\\') ||
    decoded.includes(':') ||
    decoded.startsWith('//') ||
    !decoded.startsWith('/')
  ) {
    return fallback;
  }

  // Parse against trusted dummy host to verify path integrity
  try {
    const parsed = new URL(decoded, 'http://localhost');
    if (parsed.origin !== 'http://localhost' || !parsed.pathname.startsWith('/')) {
      return fallback;
    }
    // Verify pathname doesn't have double slashes
    if (parsed.pathname.startsWith('//')) {
      return fallback;
    }
    return parsed.pathname + parsed.search;
  } catch {
    return fallback;
  }
}


