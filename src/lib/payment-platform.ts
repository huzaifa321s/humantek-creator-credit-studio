/** Where a project's money came from, derived from the stored payment fields. */
export type PaymentPlatform =
  | 'paypal'
  | 'bank_transfer'
  | 'cashapp'
  | 'wallet'
  | 'none';

export const PAYMENT_PLATFORM_LABELS: Record<PaymentPlatform, string> = {
  paypal: 'PayPal',
  bank_transfer: 'Bank Transfer',
  cashapp: 'Cash App',
  wallet: 'Studio Wallet',
  none: 'No payment yet',
};

interface PaymentFields {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  fundingSource?: string | null;
  packageId?: string | null;
  instructions?: string | null;
}

export function getPaymentPlatform(p: PaymentFields): PaymentPlatform {
  const method = (p.paymentMethod || '').toLowerCase();
  if (method === 'paypal') return 'paypal';
  if (method === 'bank_transfer' || method === 'manual') return 'bank_transfer';
  if (method === 'cashapp') return 'cashapp';

  // Client-side or older checkouts may record the payment platform in the brief's instructions.
  const notes = p.instructions || '';
  if (notes.includes('[PAYMENT RECEIVED via PayPal]')) return 'paypal';
  if (notes.includes('[PAYMENT SENT via Bank Transfer')) return 'bank_transfer';
  if (notes.includes('[PAYMENT SENT via Cash App')) return 'cashapp';

  if (method === 'credits' || p.fundingSource === 'wallet' || p.packageId === 'studio-wallet') {
    return 'wallet';
  }

  // If an admin verified and marked a legacy/untagged project as paid, it is never "No payment yet".
  if ((p.paymentStatus || '').toLowerCase() === 'paid') {
    return 'bank_transfer';
  }

  return 'none';
}

/** Pulls the transaction / order reference out of the payment note, if one was recorded. */
export function getPaymentReference(instructions?: string | null): string | null {
  const notes = instructions || '';
  const match =
    notes.match(/Capture ID: ([^|\n]+)/) ||
    notes.match(/PayPal Order ID: ([^|\n]+)/) ||
    notes.match(/Reference: ([^|\n]+)/);
  return match ? match[1].trim() : null;
}
