/**
 * Live PayPal JS SDK settings (public values, safe to ship to the browser).
 *
 * Equivalent to:
 *   https://www.paypal.com/sdk/js?client-id=...&merchant-id=...&enable-funding=venmo&currency=USD&components=buttons
 */
export const PAYPAL_CLIENT_ID =
  'AblRX5G36KWq7s1CZij6E9KPH8kbJO2hwSa6xZ_Gybw960-9iz7DwmrJngxqHMPUomFf84UPFbIqtDFt';
export const PAYPAL_MERCHANT_ID = '9Z92EE4GWCBQU';

export const PAYPAL_ENABLE_FUNDING = 'venmo';
export const PAYPAL_CURRENCY = 'USD';

/** Live PayPal REST API used by the server routes. */
export const PAYPAL_API_URL = 'https://api-m.paypal.com';

/** Checkout shows the offline notice only if no client id is configured. */
export const isPayPalClientConfigured = () => PAYPAL_CLIENT_ID.length > 0;
