import type { ProjectRecord, ServiceTierLevel, UploadedFile } from '@/types';
import { sanitizeReferenceFilename } from '@/lib/references';

export interface ClientReferenceFile {
  id: string;
  filename: string;
  size: number;
  url: string;
  mimeType?: string;
}

export interface ClientProjectView {
  id: string;
  projectCode: string;
  packageName: string;
  packageId: string;
  channelName: string;
  platform: string;
  style: string;
  colors: string;
  instructions: string; // Plain text brief snapshot
  referenceLinks: string[];
  uploadedFiles: ClientReferenceFile[];
  selections: {
    id: string;
    name: string;
    level: ServiceTierLevel;
    quantity: number;
    credits: number;
  }[];
  additions: string[];
  status: ProjectRecord['status'];
  paymentStatus: ProjectRecord['paymentStatus'];
  paymentMethod?: string;
  fundingSource?: string;
  usedCredits: number;
  packagePrice: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strict Client-Safe Project Serializer.
 * Enforces an explicit allowlist of customer-facing fields.
 * NEVER leaks admin notes, fraud/risk flags, internal comments, ledger entries, or payment payloads.
 */
export function serializeClientProject(p: any): ClientProjectView {
  const referenceLinks: string[] = Array.isArray(p.reference_links || p.referenceLinks)
    ? (p.reference_links || p.referenceLinks).filter((l: any) => typeof l === 'string' && /^https?:\/\//i.test(l))
    : [];

  const rawFiles: any[] = Array.isArray(p.uploaded_files || p.uploadedFiles)
    ? (p.uploaded_files || p.uploadedFiles)
    : [];

  const uploadedFiles: ClientReferenceFile[] = rawFiles.map((f: any) => ({
    id: String(f.id || ''),
    filename: sanitizeReferenceFilename(String(f.filename || 'reference')),
    size: Number(f.size) || 0,
    url: typeof f.url === 'string' ? f.url : '',
    mimeType: typeof f.mimeType === 'string' ? f.mimeType : undefined,
  }));

  const selections = Array.isArray(p.selections)
    ? p.selections
    : (p.project_items || []).map((i: any) => ({
        id: i.service_id,
        name: i.service_name,
        level: i.tier_level as ServiceTierLevel,
        quantity: i.quantity,
        credits: i.total_credits,
      }));

  const additions = Array.isArray(p.additions)
    ? p.additions
    : (p.project_additions || []).map((a: any) => a.name);

  return {
    id: String(p.id),
    projectCode: String(p.project_code || p.projectCode || ''),
    packageName: String(p.package_name || p.packageName || ''),
    packageId: String(p.package_id || p.packageId || ''),
    channelName: String(p.channel_name || p.channelName || ''),
    platform: String(p.platform || ''),
    style: String(p.style || ''),
    colors: String(p.colors || ''),
    instructions: String(p.instructions || ''),
    referenceLinks,
    uploadedFiles,
    selections,
    additions,
    status: p.status,
    paymentStatus: p.payment_status || p.paymentStatus || 'unpaid',
    paymentMethod: p.payment_method || p.paymentMethod,
    fundingSource: p.funding_source || p.fundingSource,
    usedCredits: Number(p.total_credits ?? p.usedCredits) || 0,
    packagePrice: Number(p.package_price_usd ?? p.packagePrice) || 0,
    createdAt: String(p.created_at || p.createdAt || ''),
    updatedAt: String(p.updated_at || p.updatedAt || p.created_at || p.createdAt || ''),
  };
}

/**
 * Admin Project Serializer:
 * Includes all client fields plus administrative metadata, risk flags, and audit timestamps.
 */
export function serializeAdminProject(p: any) {
  const clientView = serializeClientProject(p);
  return {
    ...clientView,
    userId: p.user_id || p.userId,
    clientName: p.client_name || p.clientName,
    email: p.email,
    idempotencyKey: p.idempotency_key || p.idempotencyKey,
    appliedWalletCredits: Number(p.applied_wallet_credits ?? p.appliedWalletCredits) || 0,
    lastMessageAt: p.last_message_at || p.lastMessageAt || null,
    lastMessagePreview: p.last_message_preview || p.lastMessagePreview || null,
  };
}
