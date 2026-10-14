import { TIER_NAMES } from '@/lib/catalog';
import { computeOrderQuote, type OrderInput } from '@/lib/pricing';

/** PayPal caps free-text order fields (description, item name/description, ids) at 127 chars. */
const PAYPAL_TEXT_LIMIT = 127;

export interface PayPalOrderDetails {
  /** purchase_units[0].description */
  description: string;
  /** Single line item describing the package and its deliverables. */
  item: { name: string; description: string; sku: string };
  invoiceId?: string;
}

export interface PayPalOrderDetailsInput {
  /** Unique reference for this payment (internal order id, or project id in client-only checkout). */
  internalOrderId: string;
  package: { name: string; credits: number };
  customer: { name: string; email: string };
  /** Raw request body from the checkout (selections, additions, brief fields, projectId). */
  body: Record<string, unknown>;
}

const clip = (value: string, max = PAYPAL_TEXT_LIMIT) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const cleanText = (value: unknown, max = 60) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/**
 * Builds the package summary that is attached to the PayPal order, so the buyer's receipt and
 * the merchant's PayPal transaction both show what was purchased. Deliverables are re-priced
 * from the catalog (never trusted from the browser); anything that fails to price is omitted.
 */
export function buildPayPalOrderDetails({
  internalOrderId,
  package: pkg,
  customer,
  body,
}: PayPalOrderDetailsInput): PayPalOrderDetails {
  const quote = computeOrderQuote({
    packageId: typeof body.packageId === 'string' ? body.packageId : undefined,
    fundingSource: 'package',
    applyWalletCredits: false,
    selections: Array.isArray(body.selections) ? (body.selections as OrderInput['selections']) : [],
    additions: Array.isArray(body.additions) ? (body.additions as string[]) : [],
  });

  const lines = quote.ok
    ? quote.quote.selections.map((l) => `${l.name} (${TIER_NAMES[l.level]} x${l.quantity})`)
    : [];
  const additions = quote.ok ? quote.quote.additions : [];
  const usedCredits = quote.ok ? quote.quote.usedCredits : null;

  const channelName = cleanText(body.channelName);
  const platform = cleanText(body.platform, 30);
  const projectId = cleanText(body.projectId, 64);
  const customerLabel = customer.name ? `${customer.name} <${customer.email}>` : customer.email;

  const descriptionParts = [
    `${pkg.name} Package`,
    lines.length > 0 ? `${lines.length} deliverable${lines.length === 1 ? '' : 's'}` : '',
    usedCredits !== null ? `${usedCredits}/${pkg.credits} CR` : `${pkg.credits} CR`,
    channelName ? `${channelName}${platform ? ` (${platform})` : ''}` : '',
    customerLabel,
  ].filter(Boolean);

  return {
    description: clip(descriptionParts.join(' | ')),
    item: {
      name: clip(`${pkg.name} Package${channelName ? ` — ${channelName}` : ''}`),
      description: clip([...lines, ...additions.map((a) => `Add-on: ${a}`)].join(', ') || 'Studio production package'),
      sku: clip(projectId || internalOrderId),
    },
    invoiceId: clip(`HT-${internalOrderId}`),
  };
}

/** Orders v2 purchase unit carrying the package details as an itemised line. */
export function buildPurchaseUnit(amountUSD: number, customId: string | undefined, details?: PayPalOrderDetails) {
  const value = amountUSD.toFixed(2);
  return {
    custom_id: customId,
    invoice_id: details?.invoiceId,
    description: details?.description || 'Humantek Art Creator Credits Package',
    amount: {
      currency_code: 'USD',
      value,
      ...(details && { breakdown: { item_total: { currency_code: 'USD', value } } }),
    },
    ...(details && {
      items: [
        {
          name: details.item.name,
          description: details.item.description,
          sku: details.item.sku,
          quantity: '1',
          category: 'DIGITAL_GOODS',
          unit_amount: { currency_code: 'USD', value },
        },
      ],
    }),
  };
}

export const PAYPAL_APPLICATION_CONTEXT = {
  brand_name: 'Humantek Art',
  shipping_preference: 'NO_SHIPPING',
} as const;
