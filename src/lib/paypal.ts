const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_URL = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com';

const isProduction = process.env.NODE_ENV === 'production';

/** True when no real PayPal credentials are configured. */
export function isPayPalMockMode(): boolean {
  return !PAYPAL_CLIENT_SECRET || PAYPAL_CLIENT_ID === 'sb';
}

/**
 * Mock payments are only ever allowed outside production. In production a
 * missing PayPal configuration is a hard error — never a free order.
 */
function assertMockAllowed() {
  if (isProduction) {
    throw new Error('Payments are temporarily unavailable (PayPal is not configured).');
  }
}

export interface CaptureResult {
  id: string;
  status: string;
  captureId: string | null;
  amountUSD: number | null;
  currency: string | null;
  mock: boolean;
}

/**
 * Generate PayPal OAuth2 Access Token
 */
export async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to obtain PayPal OAuth token');
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Create a PayPal Checkout Order
 */
export async function createPayPalOrder(amountUSD: number, customId?: string): Promise<{ id: string; status: string }> {
  if (isPayPalMockMode()) {
    assertMockAllowed();
    return {
      id: `ORDER-MOCK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      status: 'CREATED',
    };
  }

  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: customId,
          description: 'Humantek Art Creator Credits Package',
          amount: {
            currency_code: 'USD',
            value: amountUSD.toFixed(2),
          },
        },
      ],
    }),
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Could not create PayPal order');
  }

  return data;
}

/**
 * Capture an approved PayPal order and return a normalized result
 * (status + captured amount) so callers can verify the payment.
 */
export async function capturePayPalOrder(orderId: string, expectedAmountUSD: number): Promise<CaptureResult> {
  const isMockOrder = orderId.startsWith('ORDER-MOCK-');

  if (isMockOrder || isPayPalMockMode()) {
    // A mock order id must never be accepted when real PayPal is configured.
    if (isMockOrder && !isPayPalMockMode()) {
      throw new Error('Invalid PayPal order.');
    }
    assertMockAllowed();
    return {
      id: orderId,
      status: 'COMPLETED',
      captureId: `CAPTURE-MOCK-${Date.now()}`,
      amountUSD: expectedAmountUSD,
      currency: 'USD',
      mock: true,
    };
  }

  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Could not capture PayPal order');
  }

  const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
  const value = capture?.amount?.value;

  return {
    id: data.id,
    status: data.status,
    captureId: capture?.id ?? null,
    amountUSD: value !== undefined ? Number(value) : null,
    currency: capture?.amount?.currency_code ?? null,
    mock: false,
  };
}
