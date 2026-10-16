import 'server-only';

/**
 * Structured metadata stored inside `public.promo_codes.description` for
 * Client-to-Client Credit Sharing / Gifting vouchers.
 */
export interface GiftPromoMetadata {
  v: 1;
  kind: 'client_gift';
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  note?: string;
  createdAt: string;
}

export function serializeGiftPromoMetadata(meta: Omit<GiftPromoMetadata, 'v' | 'kind'>): string {
  const payload: GiftPromoMetadata = {
    v: 1,
    kind: 'client_gift',
    senderId: meta.senderId,
    senderEmail: meta.senderEmail.trim().toLowerCase(),
    senderName: meta.senderName.trim() || meta.senderEmail.split('@')[0] || 'Creator',
    recipientEmail: meta.recipientEmail.trim().toLowerCase(),
    ...(meta.note?.trim() ? { note: meta.note.trim().slice(0, 200) } : {}),
    createdAt: meta.createdAt || new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

export function parseGiftPromoMetadata(rawDescription?: string | null): GiftPromoMetadata | null {
  if (!rawDescription || typeof rawDescription !== 'string') return null;
  const trimmed = rawDescription.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      parsed.kind === 'client_gift' &&
      typeof parsed.senderEmail === 'string' &&
      typeof parsed.recipientEmail === 'string'
    ) {
      return {
        v: 1,
        kind: 'client_gift',
        senderId: String(parsed.senderId || ''),
        senderEmail: parsed.senderEmail.trim().toLowerCase(),
        senderName: String(parsed.senderName || parsed.senderEmail.split('@')[0] || 'Creator'),
        recipientEmail: parsed.recipientEmail.trim().toLowerCase(),
        note: typeof parsed.note === 'string' ? parsed.note : undefined,
        createdAt: String(parsed.createdAt || new Date().toISOString()),
      };
    }
  } catch {
    // Not a JSON gift metadata envelope
  }
  return null;
}

export interface StudioEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  category:
    | 'gift_code_generated_recipient'
    | 'gift_code_generated_sender'
    | 'gift_code_generated_owner'
    | 'gift_code_redeemed_owner'
    | 'gift_code_redeemed_sender'
    | 'gift_code_redeemed_recipient';
  metadata?: Record<string, unknown>;
}

export interface StudioEmailDispatchResult {
  id: string;
  to: string;
  subject: string;
  category: StudioEmailPayload['category'];
  status: 'queued_template';
  dispatchedAt: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapStudioEmailLayout(opts: {
  badge: string;
  heading: string;
  subtitle: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resolvedCtaUrl = opts.ctaUrl
    ? opts.ctaUrl.startsWith('http')
      ? opts.ctaUrl
      : `${appUrl}${opts.ctaUrl}`
    : `${appUrl}/redeem-code`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#121215;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #27272a;background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(24,24,27,0.4));">
              <div style="display:inline-block;padding:4px 10px;border-radius:6px;background-color:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);color:#fbbf24;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                ${escapeHtml(opts.badge)}
              </div>
              <h1 style="margin:12px 0 4px 0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                ${escapeHtml(opts.heading)}
              </h1>
              <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
                ${escapeHtml(opts.subtitle)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-size:14px;line-height:1.6;color:#d4d4d8;">
              ${opts.bodyHtml}
              ${
                opts.ctaLabel
                  ? `<div style="margin-top:24px;">
                      <a href="${escapeHtml(resolvedCtaUrl)}" style="display:inline-block;padding:10px 20px;border-radius:10px;background-color:#f59e0b;color:#09090b;font-size:13px;font-weight:700;text-decoration:none;">
                        ${escapeHtml(opts.ctaLabel)}
                      </a>
                    </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #27272a;background-color:#0c0c0e;font-size:11px;color:#71717a;">
              Humantek Creator Credit Studio · Automated Studio Notification
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Template for the Studio Owner when a friend/recipient redeems a client-shared promo code.
 */
export function buildGiftCodeRedeemedOwnerEmailTemplate(params: {
  ownerEmail: string;
  code: string;
  credits: number;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  redeemedAt?: string;
}): StudioEmailPayload {
  const ts = params.redeemedAt || new Date().toISOString();
  const subject = `[Studio Alert] Gift Promo Code ${params.code} (${params.credits} CR) Claimed by ${params.recipientEmail}`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      A client-generated gift promo voucher has just been redeemed on <strong>Humantek Creator Credit Studio</strong>.
    </p>
    <div style="padding:16px;border-radius:12px;background-color:#18181b;border:1px solid #27272a;margin-bottom:16px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;margin-bottom:6px;">Redeemed Voucher Code</div>
      <div style="font-family:monospace;font-size:18px;font-weight:800;color:#fbbf24;letter-spacing:0.06em;">${escapeHtml(params.code)}</div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #27272a;font-size:13px;">
        <div style="margin-bottom:4px;"><strong style="color:#ffffff;">Credits Transferred:</strong> <span style="font-family:monospace;color:#34d399;font-weight:700;">+${params.credits} CR</span></div>
        <div style="margin-bottom:4px;"><strong style="color:#ffffff;">Shared By (Sender):</strong> ${escapeHtml(params.senderName)} (${escapeHtml(params.senderEmail)})</div>
        <div style="margin-bottom:4px;"><strong style="color:#ffffff;">Claimed By (Recipient):</strong> ${escapeHtml(params.recipientName)} (${escapeHtml(params.recipientEmail)})</div>
        <div><strong style="color:#ffffff;">Redeemed At:</strong> ${escapeHtml(new Date(ts).toUTCString())}</div>
      </div>
    </div>
  `;

  const text = [
    `[Humantek Creator Credit Studio — Owner Notification]`,
    `Gift Promo Code Claimed: ${params.code} (+${params.credits} CR)`,
    `Shared By (Sender): ${params.senderName} (${params.senderEmail})`,
    `Claimed By (Recipient): ${params.recipientName} (${params.recipientEmail})`,
    `Redeemed At: ${ts}`,
  ].join('\n');

  return {
    to: params.ownerEmail,
    subject,
    html: wrapStudioEmailLayout({
      badge: 'Owner Credit Transfer Alert',
      heading: `Gift Code ${params.code} Claimed (+${params.credits} CR)`,
      subtitle: `${params.recipientName} (${params.recipientEmail}) redeemed credits shared by ${params.senderName}.`,
      bodyHtml,
      ctaLabel: 'Open Credit Ledger',
      ctaUrl: `/management/ledger?customer=${encodeURIComponent(params.recipientEmail)}`,
    }),
    text,
    category: 'gift_code_redeemed_owner',
    metadata: params,
  };
}

/**
 * 2. Template for the Sender (Client A) when their friend (Client B) redeems the shared promo code.
 */
export function buildGiftCodeRedeemedSenderEmailTemplate(params: {
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  code: string;
  credits: number;
}): StudioEmailPayload {
  const subject = `Your ${params.credits} CR Gift Code (${params.code}) Was Claimed by ${params.recipientName}!`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      Hi <strong>${escapeHtml(params.senderName)}</strong>, your shared creator credits have been claimed!
    </p>
    <div style="padding:16px;border-radius:12px;background-color:#18181b;border:1px solid #27272a;">
      <div style="margin-bottom:6px;"><strong style="color:#ffffff;">Voucher Code:</strong> <span style="font-family:monospace;color:#fbbf24;font-weight:700;">${escapeHtml(params.code)}</span></div>
      <div style="margin-bottom:6px;"><strong style="color:#ffffff;">Credits Claimed:</strong> <span style="font-family:monospace;color:#34d399;font-weight:700;">${params.credits} CR</span></div>
      <div><strong style="color:#ffffff;">Claimed By:</strong> ${escapeHtml(params.recipientName)} (${escapeHtml(params.recipientEmail)})</div>
    </div>
  `;

  const text = [
    `Hi ${params.senderName},`,
    `${params.recipientName} (${params.recipientEmail}) has claimed your ${params.credits} CR gift promo code (${params.code}).`,
  ].join('\n');

  return {
    to: params.senderEmail,
    subject,
    html: wrapStudioEmailLayout({
      badge: 'Gift Credits Claimed',
      heading: `${params.recipientName} Claimed Your ${params.credits} CR Gift!`,
      subtitle: `Promo voucher ${params.code} has been redeemed into their Studio Wallet.`,
      bodyHtml,
      ctaLabel: 'View Shared Promo Codes',
      ctaUrl: '/redeem-code?tab=share',
    }),
    text,
    category: 'gift_code_redeemed_sender',
    metadata: params,
  };
}

/**
 * 3. Template for the Recipient (Client B) when a friend generates a gift promo code for them.
 */
export function buildGiftCodeCreatedRecipientEmailTemplate(params: {
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  code: string;
  credits: number;
  note?: string;
}): StudioEmailPayload {
  const subject = `${params.senderName} sent you ${params.credits} CR on Humantek Creator Credit Studio!`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      <strong>${escapeHtml(params.senderName)}</strong> (${escapeHtml(params.senderEmail)}) has gifted you <strong style="color:#fbbf24;">${params.credits} CR</strong> from their Studio Wallet!
    </p>
    ${
      params.note
        ? `<div style="padding:12px 16px;border-left:3px solid #f59e0b;background-color:#18181b;border-radius:6px;margin-bottom:16px;font-style:italic;color:#e4e4e7;">
            "${escapeHtml(params.note)}"
          </div>`
        : ''
    }
    <div style="padding:16px;border-radius:12px;background-color:#18181b;border:1px solid rgba(245,158,11,0.35);text-align:center;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;margin-bottom:6px;">Your Exclusive Promo Code</div>
      <div style="font-family:monospace;font-size:22px;font-weight:800;color:#fbbf24;letter-spacing:0.08em;">${escapeHtml(params.code)}</div>
      <div style="margin-top:8px;font-size:12px;color:#a1a1aa;">Sign in with <strong>${escapeHtml(params.recipientEmail)}</strong> and enter this code on the Redeem Promo Code page.</div>
    </div>
  `;

  const text = [
    `${params.senderName} (${params.senderEmail}) gifted you ${params.credits} CR on Humantek Creator Credit Studio!`,
    params.note ? `Note: "${params.note}"` : '',
    `Your Promo Code: ${params.code}`,
    `Sign in with ${params.recipientEmail} at /redeem-code to claim your credits.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    to: params.recipientEmail,
    subject,
    html: wrapStudioEmailLayout({
      badge: 'Creator Credit Gift Voucher',
      heading: `You Received ${params.credits} CR from ${params.senderName}!`,
      subtitle: `Redeem your personal promo code to add +${params.credits} CR to your Studio Wallet.`,
      bodyHtml,
      ctaLabel: 'Redeem Promo Code Now',
      ctaUrl: `/redeem-code?code=${encodeURIComponent(params.code)}`,
    }),
    text,
    category: 'gift_code_generated_recipient',
    metadata: params,
  };
}

/**
 * 4. Template for the Recipient (Client B) confirming their redemption.
 */
export function buildGiftCodeRedeemedRecipientEmailTemplate(params: {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  code: string;
  credits: number;
  newBalance: number;
}): StudioEmailPayload {
  const subject = `+${params.credits} CR Added to Your Studio Wallet (Code: ${params.code})`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      Hi <strong>${escapeHtml(params.recipientName)}</strong>, you have successfully redeemed promo code <strong style="font-family:monospace;color:#fbbf24;">${escapeHtml(params.code)}</strong> shared by <strong>${escapeHtml(params.senderName)}</strong>.
    </p>
    <div style="padding:16px;border-radius:12px;background-color:#18181b;border:1px solid #27272a;">
      <div style="margin-bottom:6px;"><strong style="color:#ffffff;">Credits Deposited:</strong> <span style="font-family:monospace;color:#34d399;font-weight:700;">+${params.credits} CR</span></div>
      <div><strong style="color:#ffffff;">New Studio Wallet Balance:</strong> <span style="font-family:monospace;color:#fbbf24;font-weight:700;">${params.newBalance} CR</span></div>
    </div>
  `;

  const text = [
    `Hi ${params.recipientName},`,
    `+${params.credits} CR from promo code ${params.code} (shared by ${params.senderName}) have been added to your Studio Wallet.`,
    `New Balance: ${params.newBalance} CR`,
  ].join('\n');

  return {
    to: params.recipientEmail,
    subject,
    html: wrapStudioEmailLayout({
      badge: 'Wallet Credit Confirmation',
      heading: `+${params.credits} CR Added to Your Studio Wallet`,
      subtitle: `Shared by ${params.senderName} (${params.senderEmail}) via code ${params.code}.`,
      bodyHtml,
      ctaLabel: 'View Studio Wallet',
      ctaUrl: '/wallet',
    }),
    text,
    category: 'gift_code_redeemed_recipient',
    metadata: params,
  };
}

/**
 * Template-based email dispatcher (no external SMTP configuration required).
 * Renders and logs structured email dispatches for Owner, Sender, and Recipient notifications.
 */
export async function sendStudioEmail(
  payload: StudioEmailPayload
): Promise<StudioEmailDispatchResult> {
  const dispatchResult: StudioEmailDispatchResult = {
    id: `email-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    to: payload.to,
    subject: payload.subject,
    category: payload.category,
    status: 'queued_template',
    dispatchedAt: new Date().toISOString(),
  };

  if (process.env.NODE_ENV !== 'test') {
    console.info(
      `[StudioEmailTemplate] Dispatched (${payload.category}) -> To: ${payload.to} | Subject: "${payload.subject}"`
    );
  }

  return dispatchResult;
}
