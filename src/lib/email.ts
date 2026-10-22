import 'server-only';
import fs from 'fs';
import path from 'path';
import nodemailer, { type Transporter } from 'nodemailer';

const STUDIO_LOGO_CID = 'humantek-studio-logo@humantekart.com';
let cachedBrandLogoBuffer: Buffer | null = null;

function loadBrandLogoBuffer(): Buffer | null {
  if (cachedBrandLogoBuffer) return cachedBrandLogoBuffer;
  const candidates = [
    path.join(process.cwd(), 'public', 'brand', 'logo-email.png'),
    path.join(process.cwd(), 'public', 'brand', 'logo-light.png'),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        cachedBrandLogoBuffer = fs.readFileSync(filePath);
        return cachedBrandLogoBuffer;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

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

export interface StudioEmailAttachment {
  filename: string;
  content: Buffer | Uint8Array | ArrayBuffer;
  contentType?: string;
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
    | 'gift_code_redeemed_recipient'
    | 'payment_receipt_client'
    | 'payment_received_owner'
    | 'payment_refunded_client'
    | 'project_order_client'
    | 'project_order_owner'
    | 'project_status_client'
    | 'wallet_adjustment_client'
    | 'team_invitation'
    | 'chat_message_alert';
  attachments?: StudioEmailAttachment[];
  metadata?: Record<string, unknown>;
}

export interface StudioEmailDispatchResult {
  id: string;
  to: string;
  subject: string;
  category: StudioEmailPayload['category'];
  status: 'sent' | 'skipped_not_configured' | 'failed';
  dispatchedAt: string;
  error?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveAppUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  const rawEnvUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ''
  ).trim();
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(rawEnvUrl);
  const appUrl = (
    !rawEnvUrl || isLocalhost
      ? 'https://credits.humantekart.com'
      : rawEnvUrl
  ).replace(/\/$/, '');
  return `${appUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

const STUDIO_EMAIL_FONT_STACK =
  "'Outfit','Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function buildEmailDetailsTable(rows: Array<[label: string, value: string]>): string {
  if (!rows.length) return '';
  const rowsHtml = rows
    .map(([label, value], idx) => {
      const isLast = idx === rows.length - 1;
      const borderStyle = isLast ? '' : 'border-bottom:1px solid #e4e4e7;';
      const isCreditPositive = /^\+\d+/.test(value.trim());
      const isCreditNegative = /^-\d+/.test(value.trim());
      const valueColor = isCreditPositive
        ? '#059669'
        : isCreditNegative
          ? '#dc2626'
          : '#18181b';
      const isReferenceCode = /^(HT-|INV-HT-|GIFT-)/i.test(value.trim());
      const valueWeight =
        isReferenceCode || isCreditPositive || isCreditNegative || /^(\$|\d+\s*Credits)/i.test(value.trim())
          ? 'font-weight:700;'
          : 'font-weight:600;';
      const valueTracking = isReferenceCode ? 'letter-spacing:0.02em;' : '';
      return `<tr>
        <td style="padding:10px 14px;${borderStyle}font-family:${STUDIO_EMAIL_FONT_STACK};font-size:12px;font-weight:600;color:#71717a;width:42%;vertical-align:top;">
          ${escapeHtml(label)}
        </td>
        <td align="right" style="padding:10px 14px;${borderStyle}font-family:${STUDIO_EMAIL_FONT_STACK};font-size:13px;color:${valueColor};${valueWeight}${valueTracking}text-align:right;vertical-align:top;">
          ${escapeHtml(value)}
        </td>
      </tr>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border:1px solid #e4e4e7;border-radius:12px;background-color:#fafafa;border-collapse:separate;overflow:hidden;font-family:${STUDIO_EMAIL_FONT_STACK};">
    ${rowsHtml}
  </table>`;
}

function wrapStudioEmailLayout(opts: {
  badge: string;
  heading: string;
  subtitle?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const resolvedCtaUrl = resolveAppUrl(opts.ctaUrl || '/dashboard');
  const studioHomeUrl = resolveAppUrl('/dashboard');
  const hasInlineLogo = Boolean(loadBrandLogoBuffer());
  const brandLogoSrc = hasInlineLogo
    ? `cid:${STUDIO_LOGO_CID}`
    : resolveAppUrl('/brand/logo-email.png');
  const cleanHeading = opts.heading.trim();
  const cleanSubtitle = (opts.subtitle || '').trim();
  const showSubtitle = Boolean(
    cleanSubtitle && cleanSubtitle.toLowerCase() !== cleanHeading.toLowerCase()
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(cleanHeading)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
    body, table, td, div, p, span, a, h1, strong {
      font-family: ${STUDIO_EMAIL_FONT_STACK};
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${STUDIO_EMAIL_FONT_STACK};color:#18181b;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:36px 16px;font-family:${STUDIO_EMAIL_FONT_STACK};">
    <tr>
      <td align="center" style="font-family:${STUDIO_EMAIL_FONT_STACK};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(24,24,27,0.06);font-family:${STUDIO_EMAIL_FONT_STACK};">
          <!-- Top Amber Gold Studio Accent Bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#f59e0b 0%,#fbbf24 50%,#d97706 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Dark Studio Brand Header -->
          <tr>
            <td style="padding:20px 32px;background-color:#18181b;border-bottom:1px solid #27272a;font-family:${STUDIO_EMAIL_FONT_STACK};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-family:${STUDIO_EMAIL_FONT_STACK};">
                <tr>
                  <td valign="middle" style="font-family:${STUDIO_EMAIL_FONT_STACK};">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="font-family:${STUDIO_EMAIL_FONT_STACK};">
                      <tr>
                        <td valign="middle" style="padding-right:12px;">
                          <img src="${escapeHtml(brandLogoSrc)}" alt="Humantek Art" width="64" height="26" style="display:block;border:0;outline:none;text-decoration:none;height:26px;width:64px;color:#ffffff;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:13px;font-weight:800;" />
                        </td>
                        <td valign="middle" style="border-left:1px solid #3f3f46;padding-left:12px;font-family:${STUDIO_EMAIL_FONT_STACK};">
                          <div style="font-family:${STUDIO_EMAIL_FONT_STACK};font-size:13px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff;line-height:1.2;">
                            HUMANTEK <span style="color:#f59e0b;">ART</span>
                          </div>
                          <div style="font-family:${STUDIO_EMAIL_FONT_STACK};font-size:11px;font-weight:500;color:#a1a1aa;margin-top:2px;">
                            Official Studio Portal
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" style="padding-left:12px;font-family:${STUDIO_EMAIL_FONT_STACK};">
                    <span style="font-family:${STUDIO_EMAIL_FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#fbbf24;white-space:nowrap;">
                      Creator Credit Studio
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Event Pill Badge + Main Heading & Optional Subtitle -->
          <tr>
            <td style="padding:26px 32px 16px 32px;border-bottom:1px solid #f4f4f5;font-family:${STUDIO_EMAIL_FONT_STACK};">
              <div style="margin-bottom:10px;font-family:${STUDIO_EMAIL_FONT_STACK};">
                <span style="display:inline-block;padding:4px 11px;border-radius:999px;background-color:#fffbeb;border:1px solid #fde68a;color:#b45309;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;">
                  ${escapeHtml(opts.badge)}
                </span>
              </div>
              <h1 style="margin:0;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:21px;font-weight:800;color:#18181b;letter-spacing:-0.02em;line-height:1.35;">
                ${escapeHtml(cleanHeading)}
              </h1>
              ${
                showSubtitle
                  ? `<p style="margin:6px 0 0 0;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:13px;color:#71717a;line-height:1.5;">
                      ${escapeHtml(cleanSubtitle)}
                    </p>`
                  : ''
              }
            </td>
          </tr>
          <!-- Body Content & CTA -->
          <tr>
            <td style="padding:22px 32px 30px 32px;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:14px;line-height:1.65;color:#3f3f46;">
              ${opts.bodyHtml}
              ${
                opts.ctaLabel
                  ? `<div style="margin-top:24px;font-family:${STUDIO_EMAIL_FONT_STACK};">
                      <a href="${escapeHtml(resolvedCtaUrl)}" style="display:inline-block;padding:12px 24px;border-radius:10px;background-color:#f59e0b;color:#09090b;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.01em;box-shadow:0 2px 6px rgba(245,158,11,0.28);">
                        ${escapeHtml(opts.ctaLabel)} &rarr;
                      </a>
                    </div>`
                  : ''
              }
            </td>
          </tr>
          <!-- Studio Footer -->
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #e4e4e7;background-color:#fafafa;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:11px;color:#71717a;line-height:1.5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-family:${STUDIO_EMAIL_FONT_STACK};">
                <tr>
                  <td style="font-family:${STUDIO_EMAIL_FONT_STACK};">
                    <strong style="color:#3f3f46;font-family:${STUDIO_EMAIL_FONT_STACK};">Humantek Creator Credit Studio</strong> · Official Studio Notification
                  </td>
                  <td align="right" style="font-family:${STUDIO_EMAIL_FONT_STACK};">
                    <a href="${escapeHtml(studioHomeUrl)}" style="color:#d97706;font-family:${STUDIO_EMAIL_FONT_STACK};font-weight:600;text-decoration:none;">Open Studio</a>
                  </td>
                </tr>
              </table>
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
  const subject = `[Studio Alert] Gift Promo Code ${params.code} (${params.credits} Credits) Claimed by ${params.recipientEmail}`;

  const bodyHtml = `
    <p style="margin:0;">
      A client-generated gift promo voucher has just been redeemed on <strong style="color:#18181b;">Humantek Creator Credit Studio</strong>.
    </p>
    ${buildEmailDetailsTable([
      ['Voucher Code', params.code],
      ['Credits Transferred', `+${params.credits} Credits`],
      ['Shared By (Sender)', `${params.senderName} (${params.senderEmail})`],
      ['Claimed By (Recipient)', `${params.recipientName} (${params.recipientEmail})`],
      ['Redeemed At', new Date(ts).toUTCString()],
    ])}
  `;

  const text = [
    `[Humantek Creator Credit Studio — Owner Notification]`,
    `Gift Promo Code Claimed: ${params.code} (+${params.credits} Credits)`,
    `Shared By (Sender): ${params.senderName} (${params.senderEmail})`,
    `Claimed By (Recipient): ${params.recipientName} (${params.recipientEmail})`,
    `Redeemed At: ${ts}`,
  ].join('\n');

  return {
    to: params.ownerEmail,
    subject,
    html: wrapStudioEmailLayout({
      badge: 'Owner Credit Transfer',
      heading: `Gift Code ${params.code} Claimed (+${params.credits} Credits)`,
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
  const subject = `Your ${params.credits} Credits Gift Code (${params.code}) Was Claimed by ${params.recipientName}!`;

  const bodyHtml = `
    <p style="margin:0;">
      Hi <strong style="color:#18181b;">${escapeHtml(params.senderName)}</strong>, your shared creator credits have been claimed!
    </p>
    ${buildEmailDetailsTable([
      ['Voucher Code', params.code],
      ['Credits Claimed', `+${params.credits} Credits`],
      ['Claimed By', `${params.recipientName} (${params.recipientEmail})`],
    ])}
  `;

  const text = [
    `Hi ${params.senderName},`,
    `${params.recipientName} (${params.recipientEmail}) has claimed your ${params.credits} Credits gift promo code (${params.code}).`,
  ].join('\n');

  return {
    to: params.senderEmail,
    subject,
    html: wrapStudioEmailLayout({
      badge: 'Gift Credits Claimed',
      heading: `${params.recipientName} Claimed Your ${params.credits} Credits Gift!`,
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
  const subject = `${params.senderName} sent you ${params.credits} Credits on Humantek Creator Credit Studio!`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      <strong style="color:#18181b;">${escapeHtml(params.senderName)}</strong> (${escapeHtml(params.senderEmail)}) has gifted you <strong style="color:#d97706;">+${params.credits} Credits</strong> from their Studio Wallet!
    </p>
    ${
      params.note
        ? `<div style="padding:12px 16px;border-left:3px solid #f59e0b;background-color:#fffbeb;border-radius:8px;margin-bottom:16px;font-style:italic;color:#78350f;">
            "${escapeHtml(params.note)}"
          </div>`
        : ''
    }
    <div style="padding:20px;border-radius:12px;background-color:#fffbeb;border:1px solid #fde68a;text-align:center;font-family:${STUDIO_EMAIL_FONT_STACK};">
      <div style="font-family:${STUDIO_EMAIL_FONT_STACK};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#92400e;margin-bottom:6px;">Your Exclusive Promo Code</div>
      <div style="font-family:${STUDIO_EMAIL_FONT_STACK};font-size:22px;font-weight:800;color:#18181b;letter-spacing:0.08em;">${escapeHtml(params.code)}</div>
      <div style="margin-top:8px;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:12px;color:#71717a;">Sign in with <strong style="color:#18181b;">${escapeHtml(params.recipientEmail)}</strong> and enter this code on the Redeem Promo Code page.</div>
    </div>
  `;

  const text = [
    `${params.senderName} (${params.senderEmail}) gifted you ${params.credits} Credits on Humantek Creator Credit Studio!`,
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
      heading: `You Received ${params.credits} Credits from ${params.senderName}!`,
      subtitle: `Redeem your personal promo code to add +${params.credits} Credits to your Studio Wallet.`,
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
  const subject = `+${params.credits} Credits Added to Your Studio Wallet (Code: ${params.code})`;

  const bodyHtml = `
    <p style="margin:0;font-family:${STUDIO_EMAIL_FONT_STACK};">
      Hi <strong style="color:#18181b;">${escapeHtml(params.recipientName)}</strong>, you have successfully redeemed promo code <strong style="font-family:${STUDIO_EMAIL_FONT_STACK};color:#d97706;">${escapeHtml(params.code)}</strong> shared by <strong style="color:#18181b;">${escapeHtml(params.senderName)}</strong>.
    </p>
    ${buildEmailDetailsTable([
      ['Voucher Code', params.code],
      ['Credits Deposited', `+${params.credits} Credits`],
      ['New Studio Wallet Balance', `${params.newBalance} Credits`],
    ])}
  `;

  const text = [
    `Hi ${params.recipientName},`,
    `+${params.credits} Credits from promo code ${params.code} (shared by ${params.senderName}) have been added to your Studio Wallet.`,
    `New Balance: ${params.newBalance} Credits`,
  ].join('\n');

  return {
    to: params.recipientEmail,
    subject,
    html: wrapStudioEmailLayout({
      badge: 'Wallet Credit Confirmation',
      heading: `+${params.credits} Credits Added to Your Studio Wallet`,
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
 * Generic branded template used by in-app notification events (payments,
 * orders, project status, wallet adjustments, team invites, chat alerts).
 */
export function buildStudioNotificationEmail(params: {
  to: string;
  category: StudioEmailPayload['category'];
  subject: string;
  badge: string;
  heading: string;
  subtitle?: string;
  message: string;
  greetingName?: string;
  details?: Array<[label: string, value: string]>;
  ctaLabel?: string;
  ctaUrl?: string;
  attachments?: StudioEmailAttachment[];
}): StudioEmailPayload {
  const detailsHtml = params.details?.length ? buildEmailDetailsTable(params.details) : '';
  const invoiceRow = params.details?.find(([label]) => label.toLowerCase() === 'invoice');
  const projectRow = params.details?.find(([label]) => label.toLowerCase() === 'project');
  const fallbackPdfName =
    projectRow?.[1]
      ? `Humantek-Invoice-${projectRow[1].replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`
      : invoiceRow?.[1]
        ? `Humantek-${invoiceRow[1].replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`
        : undefined;
  const attachedPdfName = params.attachments?.[0]?.filename || fallbackPdfName;
  const attachmentBannerHtml = attachedPdfName
    ? `<div style="margin-top:14px;padding:10px 14px;border-radius:10px;background-color:#fffbeb;border:1px solid #fde68a;font-family:${STUDIO_EMAIL_FONT_STACK};font-size:12px;color:#92400e;">
        &#128206; <strong>Official PDF Invoice:</strong> <span style="font-family:${STUDIO_EMAIL_FONT_STACK};font-weight:700;color:#78350f;">${escapeHtml(attachedPdfName)}</span> ${params.attachments?.length ? '(attached to this email)' : '(available in your project drawer)'}
      </div>`
    : '';

  const bodyHtml = `
    ${params.greetingName ? `<p style="margin:0 0 12px 0;font-family:${STUDIO_EMAIL_FONT_STACK};">Hi <strong style="color:#18181b;font-family:${STUDIO_EMAIL_FONT_STACK};">${escapeHtml(params.greetingName)}</strong>,</p>` : ''}
    <p style="margin:0;color:#3f3f46;font-family:${STUDIO_EMAIL_FONT_STACK};">${escapeHtml(params.message)}</p>
    ${detailsHtml}
    ${attachmentBannerHtml}
  `;

  const text = [
    params.greetingName ? `Hi ${params.greetingName},` : '',
    params.message,
    ...(params.details || []).map(([label, value]) => `${label}: ${value}`),
    attachedPdfName ? `Attached PDF Invoice: ${attachedPdfName}` : '',
    params.ctaUrl ? `${params.ctaLabel || 'Open'}: ${resolveAppUrl(params.ctaUrl)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    to: params.to,
    subject: params.subject,
    html: wrapStudioEmailLayout({
      badge: params.badge,
      heading: params.heading,
      subtitle: params.subtitle,
      bodyHtml,
      ctaLabel: params.ctaLabel,
      ctaUrl: params.ctaUrl,
    }),
    text,
    category: params.category,
    attachments: params.attachments,
  };
}

function cleanEnvValue(val?: string | null): string {
  if (!val) return '';
  return val.trim().replace(/^["']+|["']+$/g, '').trim();
}

function resolveFromHeader(smtpUser: string): string {
  const raw = cleanEnvValue(process.env.EMAIL_FROM);
  if (!raw) {
    return `"Humantek Creator Credit Studio" <${smtpUser}>`;
  }
  const angleMatch = raw.match(/^(.*?)<([^>]+)>\s*$/);
  if (angleMatch) {
    const displayName = cleanEnvValue(angleMatch[1]) || 'Humantek Creator Credit Studio';
    const addr = cleanEnvValue(angleMatch[2]) || smtpUser;
    return `"${displayName.replace(/"/g, '')}" <${addr}>`;
  }
  if (raw.includes('@')) {
    return raw;
  }
  return `"${raw.replace(/"/g, '')}" <${smtpUser}>`;
}

function resolveFromAddress(smtpUser: string): string {
  const raw = cleanEnvValue(process.env.EMAIL_FROM);
  if (!raw) return smtpUser;
  const angleMatch = raw.match(/<([^>]+)>/);
  if (angleMatch && angleMatch[1]?.includes('@')) {
    return cleanEnvValue(angleMatch[1]);
  }
  if (raw.includes('@') && !raw.includes(' ')) {
    return raw;
  }
  return smtpUser;
}

function createSmtpTransporter(portOverride?: number): Transporter | null {
  const rawHost = cleanEnvValue(process.env.SMTP_HOST);
  const host = rawHost.toLowerCase() === 'mail.humantekart.com' ? 'chp05.wehostwebserver.com' : rawHost;
  const user = cleanEnvValue(process.env.SMTP_USER);
  const pass = cleanEnvValue(process.env.SMTP_PASS);
  if (!host || !user || !pass) return null;

  const port = portOverride || Number(cleanEnvValue(process.env.SMTP_PORT)) || 465;
  const secure = process.env.SMTP_SECURE
    ? cleanEnvValue(process.env.SMTP_SECURE) === 'true'
    : port === 465;

  const senderDomain = (user.split('@')[1] || 'humantekart.com').trim();

  return nodemailer.createTransport({
    name: senderDomain,
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

/**
 * Delivers a studio email over SMTP. Never throws: failures are logged and
 * reported in the result so callers' main flows are not interrupted.
 * Without SMTP configuration the email is only logged (local development).
 */
export async function sendStudioEmail(
  payload: StudioEmailPayload
): Promise<StudioEmailDispatchResult> {
  const dispatchResult: StudioEmailDispatchResult = {
    id: `email-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    to: payload.to,
    subject: payload.subject,
    category: payload.category,
    status: 'skipped_not_configured',
    dispatchedAt: new Date().toISOString(),
  };

  if (!payload.to || !payload.to.includes('@')) {
    return { ...dispatchResult, status: 'failed', error: 'Invalid recipient address' };
  }

  const smtpUser = cleanEnvValue(process.env.SMTP_USER);
  const transporter = createSmtpTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV !== 'test') {
      console.info(
        `[StudioEmail] SMTP not configured, skipped (${payload.category}) -> To: ${payload.to} | Subject: "${payload.subject}"`
      );
    }
    return dispatchResult;
  }

  const from = resolveFromHeader(smtpUser);
  const fromAddress = resolveFromAddress(smtpUser);
  const senderDomain = (fromAddress.split('@')[1] || 'humantekart.com').trim();
  const replyTo = cleanEnvValue(process.env.EMAIL_REPLY_TO) || fromAddress;
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2, 10)}@${senderDomain}>`;
  const userAttachments =
    payload.attachments?.map((att) => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content)
        ? att.content
        : Buffer.from(
            att.content instanceof ArrayBuffer ? new Uint8Array(att.content) : att.content
          ),
      contentType: att.contentType || 'application/pdf',
    })) || [];

  const brandLogoBuf = loadBrandLogoBuffer();
  const inlineLogoAttachment =
    brandLogoBuf && payload.html.includes(`cid:${STUDIO_LOGO_CID}`)
      ? [
          {
            filename: 'logo-email.png',
            content: brandLogoBuf,
            contentType: 'image/png',
            cid: STUDIO_LOGO_CID,
            contentDisposition: 'inline' as const,
          },
        ]
      : [];

  const nodemailerAttachments = [...inlineLogoAttachment, ...userAttachments];
  const mailOptions = {
    from,
    sender: fromAddress,
    replyTo,
    to: payload.to,
    subject: payload.subject,
    messageId,
    html: payload.html,
    text: payload.text,
    headers: {
      'X-Entity-Ref-ID': dispatchResult.id,
      'Auto-Submitted': 'auto-generated',
    },
    ...(nodemailerAttachments?.length ? { attachments: nodemailerAttachments } : {}),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { ...dispatchResult, id: info.messageId || dispatchResult.id, status: 'sent' };
  } catch (err) {
    const primaryMsg = err instanceof Error ? err.message : String(err);
    const configuredPort = Number(cleanEnvValue(process.env.SMTP_PORT)) || 465;
    const fallbackPort = configuredPort === 465 ? 587 : 465;
    try {
      const fallbackTransporter = createSmtpTransporter(fallbackPort);
      if (fallbackTransporter) {
        const info = await fallbackTransporter.sendMail(mailOptions);
        return { ...dispatchResult, id: info.messageId || dispatchResult.id, status: 'sent' };
      }
    } catch (fallbackErr) {
      const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      const combined = `Port ${configuredPort}: ${primaryMsg} | Port ${fallbackPort}: ${fbMsg}`;
      console.warn(`[StudioEmail] Failed to send (${payload.category}) -> ${payload.to}: ${combined}`);
      return { ...dispatchResult, status: 'failed', error: combined };
    }
    console.warn(`[StudioEmail] Failed to send (${payload.category}) -> ${payload.to}: ${primaryMsg}`);
    return { ...dispatchResult, status: 'failed', error: primaryMsg };
  }
}
