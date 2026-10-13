'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PaymentButtonsSkeleton } from '@/components/PayPalButtonWrapper';

/**
 * Port of the WordPress `[humantekart_paypal]` shortcode (PayPal Smart Buttons + Apple Pay).
 *
 * SDK script URLs are intentionally left blank — fill them in before going live:
 *  - PAYPAL_SDK_SRC:    https://www.paypal.com/sdk/js?client-id=...&currency=USD&components=buttons,applepay
 *  - APPLE_PAY_SDK_SRC: https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js
 */
export const PAYPAL_SDK_SRC = '';
export const APPLE_PAY_SDK_SRC = '';

/** Merchant account that receives the funds. */
const PAYEE_EMAIL = 'humantekart@gmail.com';
const MERCHANT_DISPLAY_NAME = 'HUMANTEK INC';

/** Server endpoints used by the Apple Pay flow (same as the original shortcode). */
const APPLE_PAY_CREATE_ORDER_URL = '/create_order';
const APPLE_PAY_COMPLETE_ORDER_URL = '/complete_order';
const INTENT = 'capture';

/** PayPal caps free-text order fields (description, item name/description, custom_id, invoice_id) at 127 chars. */
const PAYPAL_TEXT_LIMIT = 127;

export const isPayPalSdkConfigured = () => PAYPAL_SDK_SRC.trim().length > 0;

export interface CheckoutDeliverable {
  name: string;
  scope: string;
  credits: number | null;
}

export interface HumantekartOrderDetails {
  projectId: string;
  packageName: string;
  packagePrice: number;
  packageCredits: number;
  totalUsableCredits: number;
  usedCredits: number;
  appliedWalletCredits: number;
  deliverables: CheckoutDeliverable[];
  additions: string[];
  channelName: string;
  platform: string;
  promoCode?: string;
  customerName: string;
  customerEmail: string;
}

export interface HumantekartPaymentResult {
  orderId: string;
  captureId?: string;
  status?: string;
  payerEmail?: string;
  amount: string;
  method: 'paypal' | 'applepay';
}

interface HumantekartPayPalCheckoutProps {
  order: HumantekartOrderDetails;
  onPaid: (result: HumantekartPaymentResult) => void;
  onError: (msg: string) => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Untyped handles to the globals injected by the PayPal and Apple Pay SDK scripts. */
const sdkWindow = () => window as unknown as { paypal?: any; ApplePaySession?: any };

const clip = (value: string, max = PAYPAL_TEXT_LIMIT) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const formatUsd = (value: number) => value.toLocaleString('en-US');

/** Full, human-readable order summary shown to the buyer before paying. */
export function buildOrderSummary(order: HumantekartOrderDetails): string {
  const lines = [
    `Package: ${order.packageName} — $${formatUsd(order.packagePrice)} USD (${order.packageCredits} CR)`,
    `Project ID: ${order.projectId}`,
    `Channel / Brand: ${order.channelName || '—'} (${order.platform || '—'})`,
    `Deliverables (${order.deliverables.length}):`,
    ...order.deliverables.map(
      (d) => `  • ${d.name} — ${d.scope} — ${d.credits === null ? 'TBC' : `${d.credits} CR`}`
    ),
  ];
  if (order.additions.length > 0) lines.push(`Add-ons: ${order.additions.join(', ')}`);
  if (order.appliedWalletCredits > 0) lines.push(`Applied from wallet: +${order.appliedWalletCredits} CR`);
  lines.push(
    `Credits: ${order.usedCredits} used of ${order.totalUsableCredits} CR` +
      (order.totalUsableCredits > order.usedCredits
        ? ` (+${order.totalUsableCredits - order.usedCredits} CR rollover to wallet)`
        : '')
  );
  if (order.promoCode) lines.push(`Promo code: ${order.promoCode}`);
  lines.push(`Customer: ${order.customerName} (${order.customerEmail})`);
  return lines.join('\n');
}

/** Compact one-line description that fits PayPal's 127-char purchase unit description. */
function buildPayPalDescription(order: HumantekartOrderDetails): string {
  return clip(
    `${order.packageName} Package | ${order.deliverables.length} deliverables | ` +
      `${order.usedCredits}/${order.totalUsableCredits} CR | ${order.channelName || 'Brief'}`
  );
}

/**
 * Builds the PayPal purchase unit. Package + deliverables travel as an itemised line so both
 * the buyer's receipt and the merchant's transaction details show exactly what was purchased.
 */
function buildPurchaseUnits(order: HumantekartOrderDetails, customerName: string) {
  const value = order.packagePrice.toFixed(2);
  const deliverablesText = order.deliverables
    .map((d) => `${d.name} (${d.scope})`)
    .concat(order.additions)
    .join(', ');

  return [
    {
      reference_id: clip(order.projectId, 256),
      description: buildPayPalDescription(order),
      custom_id: clip(`${order.projectId}|${order.customerEmail}`),
      invoice_id: clip(`HT-${order.projectId}`),
      soft_descriptor: 'HUMANTEK',
      payee: { email_address: PAYEE_EMAIL },
      amount: {
        currency_code: 'USD',
        value,
        breakdown: { item_total: { currency_code: 'USD', value } },
      },
      items: [
        {
          name: clip(`${order.packageName} Package — ${customerName || order.customerEmail}`),
          description: clip(deliverablesText || 'Studio production package'),
          sku: clip(order.projectId),
          quantity: '1',
          category: 'DIGITAL_GOODS',
          unit_amount: { currency_code: 'USD', value },
        },
      ],
    },
  ];
}

const loadedScripts = new Map<string, Promise<void>>();

function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.onload = () => resolve();
    el.onerror = () => {
      loadedScripts.delete(src);
      el.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(el);
  });
  loadedScripts.set(src, promise);
  return promise;
}

export function HumantekartPayPalCheckout({ order, onPaid, onError }: HumantekartPayPalCheckoutProps) {
  const [name, setName] = useState(order.customerName);
  const [agreed, setAgreed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [sdkState, setSdkState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [applePayEligible, setApplePayEligible] = useState(false);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const applePayContainerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<any>(null);

  // Buttons are rendered once; handlers read the latest values through this ref.
  const latest = useRef({ order, name, agreed, onPaid, onError });
  useLayoutEffect(() => {
    latest.current = { order, name, agreed, onPaid, onError };
  });

  const summary = useMemo(() => buildOrderSummary(order), [order]);
  const amount = order.packagePrice.toFixed(2);
  const isValid = name.trim().length > 0 && agreed;

  useEffect(() => {
    if (!actionsRef.current) return;
    if (isValid) actionsRef.current.enable();
    else actionsRef.current.disable();
  }, [isValid]);

  useEffect(() => {
    if (!isPayPalSdkConfigured()) return;
    let cancelled = false;
    let buttons: any = null;

    const reportError = (err: unknown) => {
      console.error(err);
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'PayPal checkout was interrupted';
      latest.current.onError(msg.startsWith('PayPal') ? msg : `PayPal checkout error: ${msg}`);
    };

    const initPayPalButton = () => {
      const paypal = sdkWindow().paypal;
      if (!paypal?.Buttons || !paypalContainerRef.current) throw new Error('PayPal SDK did not initialise');

      buttons = paypal.Buttons({
        style: { color: 'gold', shape: 'pill', label: 'pay', layout: 'vertical' },

        onInit: (_data: unknown, actions: any) => {
          actionsRef.current = actions;
          const { name: n, agreed: a } = latest.current;
          if (n.trim().length > 0 && a) actions.enable();
          else actions.disable();
        },

        onClick: () => setShowErrors(true),

        createOrder: (_data: unknown, actions: any) => {
          const { order: o, name: n } = latest.current;
          return actions.order.create({
            purchase_units: buildPurchaseUnits(o, n.trim()),
            application_context: {
              brand_name: MERCHANT_DISPLAY_NAME,
              shipping_preference: 'NO_SHIPPING',
            },
          });
        },

        onApprove: (_data: unknown, actions: any) =>
          actions.order.capture().then((orderData: any) => {
            const capture = orderData?.purchase_units?.[0]?.payments?.captures?.[0];
            toast.success('Thank you for your payment!', { description: 'Payment Successful' });
            latest.current.onPaid({
              orderId: orderData?.id,
              captureId: capture?.id,
              status: capture?.status ?? orderData?.status,
              payerEmail: orderData?.payer?.email_address,
              amount: capture?.amount?.value ?? latest.current.order.packagePrice.toFixed(2),
              method: 'paypal',
            });
          }),

        onError: reportError,
      });

      return buttons.render(paypalContainerRef.current);
    };

    const initApplePay = async () => {
      const session = sdkWindow().ApplePaySession;
      if (!session) throw new Error('This device does not support Apple Pay');
      if (!session.canMakePayments()) throw new Error('This device is not capable of making Apple Pay payments');

      const applepay = sdkWindow().paypal.Applepay();
      const config = await applepay.config();
      if (cancelled || !config.isEligible || !applePayContainerRef.current) return;

      setApplePayEligible(true);
      const container = applePayContainerRef.current;
      container.innerHTML =
        '<apple-pay-button id="applepay_button" buttonstyle="black" type="plain" locale="en"></apple-pay-button>';

      container.querySelector('#applepay_button')?.addEventListener('click', () => {
        const { order: o, name: n, agreed: a } = latest.current;
        setShowErrors(true);
        if (!(n.trim().length > 0 && a)) return;

        const apSession = new session(4, {
          countryCode: config.countryCode,
          merchantCapabilities: config.merchantCapabilities,
          supportedNetworks: config.supportedNetworks,
          currencyCode: 'USD',
          requiredShippingContactFields: ['name', 'phone', 'email', 'postalAddress'],
          requiredBillingContactFields: ['postalAddress'],
          total: { label: MERCHANT_DISPLAY_NAME, type: 'final', amount: o.packagePrice.toFixed(2) },
        });

        apSession.onvalidatemerchant = (event: any) => {
          applepay
            .validateMerchant({ validationUrl: event.validationURL, displayName: MERCHANT_DISPLAY_NAME })
            .then((result: any) => apSession.completeMerchantValidation(result.merchantSession))
            .catch((err: unknown) => {
              console.error(err);
              apSession.abort();
            });
        };

        apSession.onpaymentauthorized = async (event: any) => {
          const payment = event.payment;
          try {
            const createRes = await fetch(APPLE_PAY_CREATE_ORDER_URL, {
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                intent: INTENT,
                purchase_units: buildPurchaseUnits(o, n.trim()),
                order_summary: buildOrderSummary(o),
              }),
            });
            const ppData = await createRes.json();
            const ppOrderId: string = ppData.id;
            const applePayEmail: string | undefined = payment.shippingContact?.emailAddress;

            await applepay.confirmOrder({
              orderId: ppOrderId,
              token: payment.token,
              billingContact: payment.billingContact,
            });

            const completeRes = await fetch(APPLE_PAY_COMPLETE_ORDER_URL, {
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ intent: INTENT, order_id: ppOrderId, email: applePayEmail }),
            });
            const orderDetails = await completeRes.json();
            const intentObject = INTENT === ('authorize' as string) ? 'authorizations' : 'captures';
            const payments = orderDetails.purchase_units[0].payments[intentObject][0];
            const succeeded = payments.status === 'COMPLETED';

            apSession.completePayment(succeeded ? session.STATUS_SUCCESS : session.STATUS_FAILURE);
            if (succeeded) {
              toast.success('Thank you for your payment!', { description: 'Payment Successful' });
              latest.current.onPaid({
                orderId: ppOrderId,
                captureId: payments.id,
                status: payments.status,
                payerEmail: applePayEmail,
                amount: payments.amount?.value ?? o.packagePrice.toFixed(2),
                method: 'applepay',
              });
            }
          } catch (err) {
            console.error(err);
            apSession.completePayment(session.STATUS_FAILURE);
            reportError(err);
          }
        };

        apSession.begin();
      });
    };

    (async () => {
      try {
        if (APPLE_PAY_SDK_SRC.trim()) {
          await loadScript(APPLE_PAY_SDK_SRC).catch((err) => console.error('Apple Pay SDK error:', err));
        }
        await loadScript(PAYPAL_SDK_SRC, { 'data-sdk-integration-source': 'button-factory' });
        if (cancelled) return;
        await initPayPalButton();
        if (cancelled) return;
        setSdkState('ready');
        if (sdkWindow().paypal?.Applepay) {
          initApplePay().catch((err) => console.error(err));
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setSdkState('error');
      }
    })();

    return () => {
      cancelled = true;
      actionsRef.current = null;
      try {
        buttons?.close?.();
      } catch {
        /* already torn down */
      }
    };
  }, []);

  if (!isPayPalSdkConfigured()) {
    return (
      <div className="p-2.5 sm:p-3 rounded-xl border border-amber-400/30 bg-amber-400/5 text-center text-xs space-y-0.5">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-text dark:text-amber-300">
          <AlertCircle className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
          <span>PayPal is currently offline in this environment</span>
        </div>
        <p className="text-2xs text-muted-foreground">You can still submit for review without payment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 p-3.5 rounded-xl bg-secondary/30 border border-border/60">
        <div className="space-y-1.5">
          <Label htmlFor="ht-paypal-name" className="text-xs font-semibold">Name</Label>
          <Input
            id="ht-paypal-name"
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Your Name"
            autoComplete="off"
            aria-invalid={showErrors && !name.trim()}
          />
          {showErrors && !name.trim() && <p className="text-2xs text-destructive">Please Enter a Name</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ht-paypal-description" className="text-xs font-semibold">Description</Label>
          <textarea
            id="ht-paypal-description"
            readOnly
            value={summary}
            rows={Math.min(10, summary.split('\n').length)}
            className="w-full resize-none rounded-lg border border-input bg-background/60 px-2.5 py-2 text-2xs leading-relaxed text-foreground/90 font-mono"
          />
          <p className="text-2xs text-muted-foreground">
            These package details are attached to your PayPal order so you and our studio both have a record.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ht-paypal-amount" className="text-xs font-semibold">Amount (USD)</Label>
          <Input id="ht-paypal-amount" readOnly value={amount} className="font-mono tabular-nums" />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="ht-paypal-terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            aria-invalid={showErrors && !agreed}
            className="mt-0.5"
          />
          <Label htmlFor="ht-paypal-terms" className="text-xs font-normal leading-snug">
            <span>
              By checking this box, you are agreeing to our{' '}
              <Link href="/terms-conditions" className="font-semibold underline underline-offset-2">
                Terms &amp; Conditions
              </Link>
            </span>
          </Label>
        </div>
        {showErrors && !agreed && (
          <p className="text-2xs text-destructive -mt-1">Please accept the Terms &amp; Conditions to continue</p>
        )}
      </div>

      {sdkState === 'loading' && <PaymentButtonsSkeleton />}
      {sdkState === 'error' && (
        <div className="p-3.5 text-center rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Unable to connect to PayPal</span>
          </div>
          <p className="text-2xs text-muted-foreground">
            Please check your connection or temporarily disable strict ad-blockers and refresh.
          </p>
        </div>
      )}

      <div
        ref={paypalContainerRef}
        id="paypal-button-container"
        className="relative z-10 w-full"
        style={{ colorScheme: 'none' }}
      />
      <div
        ref={applePayContainerRef}
        id="applepay-container"
        className={applePayEligible ? 'flex items-center justify-center [&_apple-pay-button]:w-full' : 'hidden'}
        style={
          {
            '--apple-pay-button-height': '45px',
            '--apple-pay-button-border-radius': '23px',
          } as CSSProperties
        }
      />

      <div className="flex items-center justify-center gap-1.5 pt-0.5 text-2xs text-muted-foreground/75 select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>Secured by PayPal 256-bit encryption</span>
      </div>
    </div>
  );
}
