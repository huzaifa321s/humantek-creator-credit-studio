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
  fundingSource?: string | null;
  packageId?: string | null;
  instructions?: string | null;
}

export function getPaymentPlatform(p: PaymentFields): PaymentPlatform {
  const method = (p.paymentMethod || '').toLowerCase();
  if (method === 'paypal') return 'paypal';
  if (method === 'bank_transfer') return 'bank_transfer';
  if (method === 'cashapp') return 'cashapp';
  if (method === 'credits' || p.fundingSource === 'wallet' || p.packageId === 'studio-wallet') {
    return 'wallet';
  }
  // Older client-side checkouts only recorded the payment in the brief's instructions.
  const notes = p.instructions || '';
  if (notes.includes('[PAYMENT RECEIVED via PayPal]')) return 'paypal';
  if (notes.includes('[PAYMENT SENT via Bank Transfer')) return 'bank_transfer';
  if (notes.includes('[PAYMENT SENT via Cash App')) return 'cashapp';
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
