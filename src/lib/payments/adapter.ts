/**
 * Universal Payment Provider Adapter Interface
 * Decouples Humantek Studio's internal orders and credit ledger from external payment processors.
 * Supports: Manual/Wire/Payoneer/Wise, PayPal, Stripe, Polar, Whop.
 */

export type PaymentProviderType = 'manual' | 'paypal' | 'stripe' | 'polar' | 'whop';

export interface ManualPaymentInstructions {
  bankName: string;
  accountTitle: string;
  iban: string;
  swiftCode: string;
  payoneerEmail: string;
  referenceCode: string;
  amountUSD: number;
  notes: string;
}

export interface CreateCheckoutParams {
  orderId: string;
  packageId: string;
  packageName: string;
  priceUSD: number;
  credits: number;
  userEmail: string;
  userId: string;
  idempotencyKey?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  provider: PaymentProviderType;
  providerOrderId: string;
  checkoutUrl?: string;
  manualInstructions?: ManualPaymentInstructions;
}

export interface NormalizedPaymentEvent {
  eventId: string;
  eventType: 'payment.completed' | 'payment.refunded' | 'payment.reversed' | 'dispute.created';
  provider: PaymentProviderType;
  providerOrderId?: string;
  providerCaptureId?: string;
  amountCents: number;
  currency: string;
  orderId?: string; // Humantek internal order UUID
  rawPayload: any;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: NormalizedPaymentEvent;
  error?: string;
}

export interface PaymentAdapter {
  provider: PaymentProviderType;
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;
  verifyWebhook(req: Request, rawBody: string): Promise<WebhookVerificationResult>;
}

/**
 * Manual / Bank Wire / Payoneer / Wise Provider Adapter
 * Perfect for initial agency clients and jurisdictions where automated merchant accounts are pending.
 */
export class ManualPaymentAdapter implements PaymentAdapter {
  provider: PaymentProviderType = 'manual';

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const referenceCode = `HT-MANUAL-${params.orderId.slice(0, 8).toUpperCase()}`;

    return {
      provider: 'manual',
      providerOrderId: referenceCode,
      manualInstructions: {
        bankName: process.env.MANUAL_PAYMENT_BANK_NAME || 'Meezan Bank Limited / Standard Chartered',
        accountTitle: process.env.MANUAL_PAYMENT_ACCOUNT_TITLE || 'Humantek Creative Studio',
        iban: process.env.MANUAL_PAYMENT_IBAN || 'PK36MEZN0000000123456701',
        swiftCode: process.env.MANUAL_PAYMENT_SWIFT || 'MEZNPKKA',
        payoneerEmail: process.env.MANUAL_PAYMENT_PAYONEER_EMAIL || 'billing@humantek.art',
        referenceCode,
        amountUSD: params.priceUSD,
        notes: `Please quote reference ${referenceCode} when initiating your transfer or Payoneer payment request. Once sent, our team will review the reference and credit your account within 2-4 hours.`,
      },
    };
  }

  async verifyWebhook(): Promise<WebhookVerificationResult> {
    // Manual payments do not use external incoming HTTP webhooks; they are confirmed via confirm_manual_payment RPC by verified studio admins.
    return {
      isValid: false,
      error: 'Manual provider does not use HTTP webhooks. Confirm via studio admin console.',
    };
  }
}

/**
 * Registry / Factory for Payment Adapters
 */
export function getPaymentAdapter(provider: PaymentProviderType = 'manual'): PaymentAdapter {
  switch (provider) {
    case 'manual':
      return new ManualPaymentAdapter();
    case 'paypal':
      // Wrap PayPal adapter when configured
      return new ManualPaymentAdapter(); // Fallback to manual
    default:
      return new ManualPaymentAdapter();
  }
}
