import type { ProjectRecord } from '@/types';
import type { OrderQuote } from '@/lib/pricing';
import type { OrderRequest } from '@/lib/validation';
import { addLedgerEntry, addProject } from '@/lib/store';

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
  return {
    id: request.projectId,
    projectCode: `HT-${Date.now().toString(36).toUpperCase()}-${pkg.id.substring(0, 5).toUpperCase()}`,
    packageId: pkg.id,
    packageName: pkg.name,
    packagePrice: quote.priceUSD,
    packageCredits: quote.totalCredits,
    usedCredits: quote.usedCredits,
    remainingCredits: quote.remainingCredits,
    status: opts.status,
    paymentStatus: opts.paymentStatus,
    clientName: request.clientName,
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

/** Persists a paid project and writes the matching credit-ledger entries. */
export function recordPaidProject(project: ProjectRecord, paymentRef: string) {
  addProject(project);
  const now = new Date().toISOString();

  addLedgerEntry({
    id: `led-${crypto.randomUUID()}`,
    userEmail: project.email,
    type: 'package_purchase',
    creditsDelta: project.packageCredits,
    usdAmount: project.packagePrice,
    referenceId: project.projectCode,
    description: `PayPal payment ${paymentRef} verified for ${project.packageName}`,
    createdAt: now,
  });

  if (project.usedCredits > 0) {
    addLedgerEntry({
      id: `led-${crypto.randomUUID()}`,
      userEmail: project.email,
      type: 'service_deduction',
      creditsDelta: -project.usedCredits,
      usdAmount: 0,
      referenceId: project.projectCode,
      description: `Credits allocated for order ${project.projectCode}`,
      createdAt: now,
    });
  }
}
