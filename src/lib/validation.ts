import { z } from 'zod';
import { PROHIBITED_REGEX } from '@/lib/catalog';

/**
 * Shared request schemas. API routes parse every request body through these
 * before touching it, so malformed or oversized payloads are rejected early.
 */

export const projectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{4,64}$/, 'Invalid project id');

export const orderLineSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().optional(),
  level: z.number().int().min(0).max(2),
  quantity: z.number().int().min(1).max(20),
  credits: z.number().int().nonnegative().optional(),
});

/**
 * Step 4 reference images. Shared by the wizard (instant feedback), the upload
 * API (issues signed upload URLs) and the order API (authoritative re-check).
 * Keep in sync with the `project-references` bucket in Supabase migrations.
 */
export const REFERENCE_LIMITS = {
  bucket: 'project-references',
  maxFiles: 10,
  maxFileBytes: 10 * 1024 * 1024, // 10 MB per image
  maxTotalBytes: 50 * 1024 * 1024, // 50 MB per project
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
  maxDailyUploadsPerUser: 30, // 30 files per user per 24 hours
  maxUserPendingBytes: 150 * 1024 * 1024, // 150 MB pending per user across all drafts
  retentionDays: 8, // 8 days (matches 7-day wizard draft + 1 day margin)
  abandonedAfterMs: 8 * 24 * 60 * 60 * 1000,
} as const;

export type ReferenceMimeType = (typeof REFERENCE_LIMITS.allowedTypes)[number];

export const uploadedFileSchema = z.object({
  id: z.string().max(100),
  filename: z.string().max(255),
  size: z.number().int().nonnegative(),
  /** Display URL only (blob: or short-lived signed URL). Never trusted or persisted. */
  url: z.string().max(4096).optional().default(''),
  /** Object path inside the `project-references` bucket. */
  storagePath: z.string().max(300).optional(),
  mimeType: z.string().max(100).optional(),
});

/** Request body for POST /api/uploads (signed upload URL issuance). */
export const referenceUploadRequestSchema = z.object({
  projectId: projectIdSchema,
  filename: z.string().trim().min(1).max(255),
  size: z
    .number()
    .int()
    .positive('Empty files cannot be uploaded')
    .max(REFERENCE_LIMITS.maxFileBytes, 'Images must be 10 MB or smaller'),
  mimeType: z.enum(REFERENCE_LIMITS.allowedTypes, { error: 'Only PNG, JPG or WebP images are allowed' }),
});

export const orderCoreSchema = z.object({
  packageId: z.string().trim().min(1).max(64).default('studio-wallet'),
  fundingSource: z.enum(['wallet', 'package', 'hybrid']).default('package'),
  walletBalance: z.number().nonnegative().optional(),
  applyWalletCredits: z.boolean().default(true),
  appliedWalletCredits: z.number().nonnegative().optional(),
  selections: z.array(orderLineSchema).min(1).max(60),
  additions: z.array(z.string().max(80)).max(20).default([]),
});

// ─── Step 4: Creative brief ──────────────────────────────────────────────
// Shared by the browser (inline field errors) and the API (authoritative).

export const PLATFORM_OPTIONS = [
  'Twitch',
  'YouTube',
  'Kick',
  'Discord',
  'TikTok / Reels',
  'Multi-Platform',
] as const;

export const BRIEF_LIMITS = {
  clientName: { min: 2, max: 80 },
  channelName: { min: 2, max: 50 },
  email: { max: 254 },
  style: { min: 2, max: 100 },
  colors: { min: 2, max: 150 },
  instructions: { min: 20, max: 3000, minWords: 5 },
  redeemCode: { min: 4, max: 32 },
} as const;

const collapseSpaces = (v: string) => v.replace(/\s+/g, ' ');
const HTML_TAG = /<\/?[a-z][^>]*>/i;
const REPEATED_CHAR = /(.)\1{9,}/;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'yopmail.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
]);
const countWords = (v: string) => v.trim().split(/\s+/).filter(Boolean).length;

export const briefFieldsSchema = z.object({
  channelName: z
    .string()
    .trim()
    .min(1, 'Channel or brand name is required')
    .min(BRIEF_LIMITS.channelName.min, `Channel name must be at least ${BRIEF_LIMITS.channelName.min} characters`)
    .max(BRIEF_LIMITS.channelName.max, `Channel name must be ${BRIEF_LIMITS.channelName.max} characters or fewer`)
    .regex(/^[\p{L}\p{M}\p{N} _.@&'-]*$/u, 'Channel name contains unsupported characters'),

  platform: z
    .string()
    .trim()
    .min(1, 'Please select your primary platform')
    .refine((val): val is (typeof PLATFORM_OPTIONS)[number] => PLATFORM_OPTIONS.includes(val as (typeof PLATFORM_OPTIONS)[number]), {
      message: 'Choose a platform from the list',
    }),

  style: z
    .string()
    .trim()
    .min(1, 'Preferred art style is required')
    .min(BRIEF_LIMITS.style.min, `Art style must be at least ${BRIEF_LIMITS.style.min} characters`)
    .max(BRIEF_LIMITS.style.max, `Art style must be ${BRIEF_LIMITS.style.max} characters or fewer`)
    .refine((v) => !HTML_TAG.test(v), 'HTML tags are not allowed'),

  colors: z
    .string()
    .trim()
    .min(1, 'Color palette or theme notes are required')
    .min(BRIEF_LIMITS.colors.min, `Color notes must be at least ${BRIEF_LIMITS.colors.min} characters`)
    .max(BRIEF_LIMITS.colors.max, `Color notes must be ${BRIEF_LIMITS.colors.max} characters or fewer`)
    .refine(
      (v) => (v.match(/#[0-9a-z]+/gi) ?? []).every((token) => HEX_COLOR.test(token)),
      'Hex colors must look like #F0A or #FF00AA'
    ),

  instructions: z
    .string()
    .trim()
    .min(1, 'Creative instructions are required')
    .min(
      BRIEF_LIMITS.instructions.min,
      `Add a little more detail — at least ${BRIEF_LIMITS.instructions.min} characters`
    )
    .max(
      BRIEF_LIMITS.instructions.max,
      `Keep the brief under ${BRIEF_LIMITS.instructions.max.toLocaleString('en-US')} characters`
    )
    .refine(
      (v) => countWords(v) >= BRIEF_LIMITS.instructions.minWords,
      `Describe your request in at least ${BRIEF_LIMITS.instructions.minWords} words`
    )
    .refine((v) => !HTML_TAG.test(v), 'HTML or script tags are not allowed')
    .refine((v) => !REPEATED_CHAR.test(v), 'Please remove long runs of repeated characters')
    .refine((v) => !PROHIBITED_REGEX.test(v), 'Your brief mentions restricted content — see the policy notice below'),
});

export type BriefFields = z.input<typeof briefFieldsSchema>;
export type BriefField = keyof BriefFields;

export const redeemCodeSchema = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/,
        `Promo codes use letters, numbers and dashes (${BRIEF_LIMITS.redeemCode.min}–${BRIEF_LIMITS.redeemCode.max} characters)`
      ),
  ])
  .default('');

export const referenceLinkSchema = z
  .string()
  .trim()
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Only HTTP and HTTPS links are allowed (no javascript: or data: URLs)')
  .max(1000, 'Link URL must be under 1,000 characters');

export const referenceLinksSchema = z
  .array(referenceLinkSchema)
  .max(10, 'You can attach up to 10 reference links')
  .default([]);

const referenceFilesSchema = z
  .array(uploadedFileSchema)
  .max(REFERENCE_LIMITS.maxFiles, `You can attach up to ${REFERENCE_LIMITS.maxFiles} reference images`)
  .default([]);

export const projectBriefSchema = briefFieldsSchema.extend({
  redeemCode: redeemCodeSchema,
  uploadedFiles: referenceFilesSchema,
  referenceLinks: referenceLinksSchema,
});

/** Full order: catalog identifiers + creative brief (all mandatory brief fields enforced). */
export const orderRequestSchema = orderCoreSchema.extend(projectBriefSchema.shape).extend({
  projectId: projectIdSchema,
  clientName: z.string().optional(),
  email: z.string().optional(),
  paymentStatus: z.enum(['paid', 'unpaid', 'pending', 'refunded']).optional(),
  /** Offline method the client says they paid with; the studio verifies it before marking paid. */
  paymentMethod: z.enum(['bank_transfer', 'cashapp']).optional(),
  status: z.enum(['pending_review', 'active', 'in_progress', 'completed', 'cancelled']).optional(),
});
export type OrderRequest = z.infer<typeof orderRequestSchema>;

export const captureOrderSchema = z.object({
  orderId: z.string().trim().min(1).max(128),
});

export const projectStatusSchema = z.enum([
  'pending_review',
  'payment_confirmed',
  'in_production',
  'review_round',
  'delivered',
  'declined',
  'cancelled',
]);

export const patchProjectSchema = z.object({
  id: z.string().trim().min(1).max(100),
  status: projectStatusSchema,
  paymentStatus: z.enum(['unpaid', 'paid', 'refunded']).optional(),
});

/** Formats the first Zod issue into a short, user-safe message. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}
