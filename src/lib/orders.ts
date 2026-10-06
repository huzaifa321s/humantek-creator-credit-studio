import type { ProjectRecord } from '@/types';
import type { OrderQuote } from '@/lib/pricing';
import type { OrderRequest } from '@/lib/validation';
import { addLedgerEntry, addProject, adjustUserBalance } from '@/lib/store';

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
    paymentMethod: opts.paymentStatus === 'paid' ? (request.fundingSource === 'wallet' ? 'credits' : 'paypal') : 'unpaid',
    fundingSource: request.fundingSource || (quote.fundingSource ?? 'package'),
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

/** Persists a paid project, records matching credit-ledger entries, and rolls over surplus credits to the global wallet. */
export function recordPaidProject(project: ProjectRecord, paymentRef: string) {
  project.paymentStatus = 'paid';
  project.paymentMethod = 'paypal';
  project.fundingSource = 'package';
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

  // Roll over any surplus credits into client's global wallet
  const netSurplus = project.packageCredits - project.usedCredits;
  if (netSurplus > 0) {
    adjustUserBalance(project.email, netSurplus);
  }
}

/** Creates and records a project funded 100% from the client's global studio credit wallet ($0 USD checkout). */
export function recordWalletFundedProject(project: ProjectRecord) {
  project.paymentStatus = 'paid';
  project.paymentMethod = 'credits';
  project.fundingSource = 'wallet';
  project.packagePrice = 0;
  addProject(project);

  const now = new Date().toISOString();

  if (project.usedCredits > 0) {
    addLedgerEntry({
      id: `led-${crypto.randomUUID()}`,
      userEmail: project.email,
      type: 'service_deduction',
      creditsDelta: -project.usedCredits,
      usdAmount: 0,
      referenceId: project.projectCode,
      description: `Studio wallet credits deployed for order ${project.projectCode}`,
      createdAt: now,
    });
  }

  // Deduct from client's global wallet
  adjustUserBalance(project.email, -project.usedCredits);
  return project;
}

