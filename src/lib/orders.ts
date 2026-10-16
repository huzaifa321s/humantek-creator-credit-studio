import type { ProjectRecord, ServiceTierLevel } from '@/types';
import type { OrderQuote } from '@/lib/pricing';
import type { OrderRequest } from '@/lib/validation';
import { addLedgerEntry, addProject, adjustUserBalance } from '@/lib/store';

export function formatDbProject(p: any): ProjectRecord {
  return {
    id: p.id,
    userId: p.user_id,
    projectCode: p.project_code,
    packageId: p.package_id || 'studio-wallet',
    packageName: p.package_name || '',
    packagePrice: Number(p.package_price_usd) || 0,
    packageCredits: p.package_credits || 0,
    usedCredits: p.total_credits || 0,
    remainingCredits: 0,
    status: p.status,
    paymentStatus: p.payment_status,
    paymentMethod: p.payment_method,
    fundingSource: p.funding_source,
    appliedWalletCredits: p.applied_wallet_credits || 0,
    clientName: p.client_name,
    channelName: p.channel_name || '',
    email: p.email,
    platform: p.platform || '',
    style: p.style || '',
    colors: p.colors || '',
    instructions: p.instructions || '',
    uploadedFiles: Array.isArray(p.uploaded_files) ? p.uploaded_files : [],
    referenceLinks: Array.isArray(p.reference_links)
      ? p.reference_links
      : Array.isArray(p.referenceLinks)
        ? p.referenceLinks
        : [],
    lastMessageAt: p.last_message_at || null,
    lastMessagePreview: p.last_message_preview || null,
    lastChatBy: p.last_chat_by || p.lastChatBy || null,
    additions: (p.project_additions || []).map((a: any) => a.name),
    selections: (p.project_items || []).map((i: any) => ({
      id: i.service_id,
      name: i.service_name,
      level: i.tier_level as ServiceTierLevel,
      quantity: i.quantity,
      credits: i.total_credits,
    })),
    createdAt: p.created_at,
    updatedAt: p.updated_at || p.updatedAt || p.created_at,
  };
}

/**
 * Resolves and attaches `last_chat_by` (the display name of the Owner or Manager
 * who most recently chatted on the project or with the client) to each DB project row.
 * Even if the client sent the very last message, this preserves the studio staff member's name
 * so Owner, Manager, and Viewer roles can see which team member is handling the conversation.
 */
export async function attachAdminLastChatBy(
  adminClient: any,
  rows: any[]
): Promise<void> {
  if (!adminClient || !Array.isArray(rows) || rows.length === 0) return;

  try {
    const projectIds = Array.from(
      new Set(rows.map((r) => String(r?.id || '')).filter(Boolean))
    );
    if (projectIds.length === 0) return;

    const [projMsgsRes, globalMsgsRes] = await Promise.all([
      adminClient
        .from('project_messages')
        .select(
          'id, project_id, sender_id, body, created_at, profiles!inner(id, full_name, email, role)'
        )
        .in('project_id', projectIds)
        .in('profiles.role', ['admin', 'manager'])
        .order('id', { ascending: false })
        .limit(500),
      adminClient
        .from('project_messages')
        .select(
          'id, project_id, sender_id, body, created_at, profiles!inner(id, full_name, email, role)'
        )
        .eq('project_id', 'global')
        .in('profiles.role', ['admin', 'manager'])
        .order('id', { ascending: false })
        .limit(300),
    ]);

    const staffMsgs = [
      ...(projMsgsRes?.data || []),
      ...(globalMsgsRes?.data || []),
    ];

    const byProjectId = new Map<string, { name: string; ts: number }>();
    const byClientUserId = new Map<string, { name: string; ts: number }>();

    for (const m of staffMsgs) {
      const rawBody = typeof m.body === 'string' ? m.body : '';
      let parsed: Record<string, unknown> | null = null;
      if (rawBody.startsWith('{')) {
        try {
          parsed = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          // Ignore malformed JSON
        }
      }
      if (parsed?.isDeleted === true) continue;

      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const staffName =
        (prof?.full_name || '').trim() ||
        (prof?.email ? String(prof.email).split('@')[0] : '') ||
        null;
      if (!staffName) continue;

      const ts = m.created_at ? new Date(m.created_at).getTime() || 0 : 0;
      const pid = String(m.project_id || '');
      if (pid && pid !== 'global') {
        if (!byProjectId.has(pid)) {
          byProjectId.set(pid, { name: staffName, ts });
        }
      } else if (pid === 'global' && parsed) {
        const cid = parsed?.clientUserId ? String(parsed.clientUserId) : '';
        if (cid && !byClientUserId.has(cid)) {
          byClientUserId.set(cid, { name: staffName, ts });
        }
      }
    }

    for (const row of rows) {
      const pid = String(row?.id || '');
      const uid = row?.user_id ? String(row.user_id) : '';
      const projHit = pid ? byProjectId.get(pid) : undefined;
      const clientHit = uid ? byClientUserId.get(uid) : undefined;
      if (projHit && clientHit) {
        row.last_chat_by = clientHit.ts > projHit.ts ? clientHit.name : projHit.name;
      } else {
        row.last_chat_by = projHit?.name || clientHit?.name || null;
      }
    }
  } catch (err) {
    console.error('Failed to resolve last_chat_by for admin projects:', err);
  }
}


/**
 * Builds a ProjectRecord exclusively from server-validated input and the
 * server-computed quote. Never pass raw client data into this function.
 */
export function buildProjectRecord(
  request: OrderRequest,
  quote: OrderQuote,
  opts: { status: ProjectRecord['status']; paymentStatus: ProjectRecord['paymentStatus'] }
): ProjectRecord {
  const pkg = quote.package;
  const pkgCodeMap: Record<string, string> = {
    'creator-forge': 'FORGE',
    'studio-momentum': 'MOMENTUM',
    'signature-collective': 'SIGNATURE',
    'studio-wallet': 'WALLET',
  };
  const pkgCode = pkgCodeMap[pkg.id] || pkg.id.split('-').pop()?.toUpperCase() || 'STUDIO';
  const randomDigits = Math.floor(1000 + Math.random() * 9000);

  return {
    id: request.projectId,
    projectCode: `HT-${randomDigits}-${pkgCode}`,
    packageId: pkg.id,
    packageName: pkg.name,
    packagePrice: quote.priceUSD,
    packageCredits: quote.packageCredits ?? 0,
    appliedWalletCredits: quote.appliedWalletCredits ?? 0,
    usedCredits: quote.usedCredits,
    remainingCredits: 0,
    status: opts.status,
    paymentStatus: opts.paymentStatus,
    paymentMethod: opts.paymentStatus === 'paid' ? (quote.fundingSource === 'wallet' ? 'credits' : 'paypal') : 'unpaid',
    fundingSource: quote.fundingSource || request.fundingSource || 'wallet',
    clientName: request.clientName || 'Creator',
    channelName: request.channelName,
    email: request.email || 'guest@humantek.art',
    platform: request.platform,
    style: request.style,
    colors: request.colors,
    instructions: request.instructions,
    redeemCode: request.redeemCode,
    additions: quote.additions,
    selections: quote.selections,
    uploadedFiles: request.uploadedFiles,
    createdAt: new Date().toISOString(),
  };
}

/** Creates and records a project funded 100% from the client's global studio credit wallet ($0 USD checkout). */
export function recordWalletFundedProject(project: ProjectRecord) {
  project.paymentStatus = 'paid';
  project.paymentMethod = 'credits';
  project.fundingSource = 'wallet';
  project.packagePrice = 0;
  addProject(project);

  const now = new Date().toISOString();
  const normEmail = (project.email || '').toLowerCase().trim();

  if (project.usedCredits > 0) {
    addLedgerEntry({
      id: `led-${crypto.randomUUID()}`,
      userEmail: normEmail,
      type: 'service_deduction',
      creditsDelta: -project.usedCredits,
      usdAmount: 0,
      referenceId: project.projectCode,
      description: `Studio wallet credits deployed for order ${project.projectCode}`,
      createdAt: now,
    });
  }

  return project;
}

