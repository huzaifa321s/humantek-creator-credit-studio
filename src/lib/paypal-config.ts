/**
 * Public PayPal JS SDK settings (safe to ship to the browser).
 *
 * Equivalent to:
 *   https://www.paypal.com/sdk/js?client-id=...&merchant-id=...&enable-funding=venmo&currency=USD&components=buttons
 *
 * NEXT_PUBLIC_PAYPAL_CLIENT_ID / NEXT_PUBLIC_PAYPAL_MERCHANT_ID override these defaults
 * (e.g. a sandbox client id for local testing).
 */
const DEFAULT_PAYPAL_CLIENT_ID =
  'AblRX5G36KWq7s1CZij6E9KPH8kbJO2hwSa6xZ_Gybw960-9iz7DwmrJngxqHMPUomFf84UPFbIqtDFt';
const DEFAULT_PAYPAL_MERCHANT_ID = '9Z92EE4GWCBQU';

const isPlaceholder = (value: string) =>
  !value ||
  value === 'sb' ||
  value === 'placeholder' ||
  value.includes('your-') ||
  value.length < 10;

const envClientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '').trim();
const envMerchantId = (process.env.NEXT_PUBLIC_PAYPAL_MERCHANT_ID || '').trim();

export const PAYPAL_CLIENT_ID = isPlaceholder(envClientId) ? DEFAULT_PAYPAL_CLIENT_ID : envClientId;
export const PAYPAL_MERCHANT_ID =
  envMerchantId && !envMerchantId.includes('your-') ? envMerchantId : DEFAULT_PAYPAL_MERCHANT_ID;

export const PAYPAL_ENABLE_FUNDING = 'venmo';
export const PAYPAL_CURRENCY = 'USD';

/** False only if the configured client id is a placeholder (checkout shows the offline notice). */
export const isPayPalClientConfigured = () => !isPlaceholder(PAYPAL_CLIENT_ID);
