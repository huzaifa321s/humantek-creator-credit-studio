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
    packageCredits: quote.packageCredits ?? quote.totalCredits,
    appliedWalletCredits: quote.appliedWalletCredits ?? 0,
    usedCredits: quote.usedCredits,
    remainingCredits: quote.remainingCredits,
    status: opts.status,
    paymentStatus: opts.paymentStatus,
    paymentMethod: opts.paymentStatus === 'paid' ? (quote.fundingSource === 'wallet' ? 'credits' : 'paypal') : 'unpaid',
    fundingSource: quote.fundingSource || request.fundingSource || 'package',
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
  project.fundingSource = project.fundingSource || 'package';
  addProject(project);
  const now = new Date().toISOString();
  const normEmail = (project.email || '').toLowerCase().trim();

  addLedgerEntry({
    id: `led-${crypto.randomUUID()}`,
    userEmail: normEmail,
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
      userEmail: normEmail,
      type: 'service_deduction',
      creditsDelta: -project.usedCredits,
      usdAmount: 0,
      referenceId: project.projectCode,
      description: `Credits allocated for order ${project.projectCode}`,
      createdAt: now,
    });
  }

  // The net surplus (packageCredits - usedCredits) is naturally and permanently
  // credited into the user's global wallet through the ledger entries above.
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

