const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_URL = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com';

/**
 * Generate PayPal OAuth2 Access Token
 */
export async function getPayPalAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_SECRET || PAYPAL_CLIENT_ID === 'sb') {
    return 'mock-sandbox-token';
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
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
export async function createPayPalOrder(amountUSD: number, customId?: string) {
  if (PAYPAL_CLIENT_ID === 'sb' && !PAYPAL_CLIENT_SECRET) {
    // Sandbox development mock order ID
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
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Could not create PayPal order');
  }

  return data;
}

/**
 * Capture an approved PayPal order
 */
export async function capturePayPalOrder(orderId: string) {
  if (orderId.startsWith('ORDER-MOCK-') || (PAYPAL_CLIENT_ID === 'sb' && !PAYPAL_CLIENT_SECRET)) {
    return {
      id: orderId,
      status: 'COMPLETED',
      captureId: `CAPTURE-MOCK-${Date.now()}`,
    };
  }

  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Could not capture PayPal order');
  }

  return data;
}
