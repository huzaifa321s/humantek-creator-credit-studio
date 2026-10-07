import { PACKAGES, SERVICES, ADDITIONS_PRICING } from '@/lib/catalog';
import type { PackageDefinition, ServiceTierLevel } from '@/types';

/**
 * Server-authoritative pricing engine.
 *
 * The browser is NEVER trusted for prices, credits, or tier limits. Every API
 * route that creates or charges for an order must recompute the quote here
 * from the catalog, using only identifiers (service id, tier level, quantity)
 * supplied by the client.
 */

export const MAX_QUANTITY_PER_SERVICE = 20;

export const STUDIO_WALLET_PACKAGE: PackageDefinition = {
  id: 'studio-wallet',
  name: 'Studio Wallet Balance',
  price: 0,
  credits: 0,
  group: 'Studio Wallet',
  bestFor: 'Funded directly from your available global studio credit balance with $0 USD checkout.',
  maxLevel: 2,
};

export interface OrderLineInput {
  id: string;
  level: number;
  quantity: number;
}

export interface OrderInput {
  packageId?: string;
  fundingSource?: 'wallet' | 'package' | 'hybrid';
  walletBalance?: number;
  applyWalletCredits?: boolean;
  appliedWalletCredits?: number;
  selections: OrderLineInput[];
  additions: string[];
}

export interface PricedLine {
  id: string;
  name: string;
  level: ServiceTierLevel;
  quantity: number;
  credits: number;
}

export interface OrderQuote {
  fundingSource: 'wallet' | 'package' | 'hybrid';
  package: PackageDefinition;
  selections: PricedLine[];
  additions: string[];
  servicesCredits: number;
  additionsCredits: number;
  usedCredits: number;
  packageCredits: number;
  appliedWalletCredits: number;
  totalCredits: number;
  remainingCredits: number;
  remainingWalletCredits?: number;
  priceUSD: number;
}

export type QuoteResult =
  | { ok: true; quote: OrderQuote }
  | { ok: false; error: string };

export function computeOrderQuote(input: OrderInput): QuoteResult {
  const isWallet =
    input.fundingSource === 'wallet' ||
    input.packageId === 'studio-wallet' ||
    input.packageId === 'wallet';

  let pkg: PackageDefinition;

  if (isWallet) {
    const balance = typeof input.walletBalance === 'number' ? input.walletBalance : 0;
    pkg = {
      ...STUDIO_WALLET_PACKAGE,
      credits: balance,
    };
  } else {
    const found = PACKAGES.find((p) => p.id === input.packageId);
    if (!found) return { ok: false, error: 'Unknown package selected.' };
    pkg = found;
  }

  if (!Array.isArray(input.selections) || input.selections.length === 0) {
    return { ok: false, error: 'Select at least one service.' };
  }

  const seen = new Set<string>();
  const lines: PricedLine[] = [];
  let standardUnits = 0;
  let eliteUnits = 0;

  for (const raw of input.selections) {
    const service = SERVICES.find((s) => s.id === raw.id);
    if (!service) return { ok: false, error: `Unknown service "${raw.id}".` };
    if (seen.has(service.id)) {
      return { ok: false, error: `Service "${service.name}" was listed more than once.` };
    }
    seen.add(service.id);

    if (raw.level !== 0 && raw.level !== 1 && raw.level !== 2) {
      return { ok: false, error: `Invalid tier for "${service.name}".` };
    }
    const level = raw.level as ServiceTierLevel;

    if (!Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > MAX_QUANTITY_PER_SERVICE) {
      return {
        ok: false,
        error: `Quantity for "${service.name}" must be between 1 and ${MAX_QUANTITY_PER_SERVICE}.`,
      };
    }

    if (level > pkg.maxLevel) {
      return { ok: false, error: `${pkg.name} does not include ${['Basic', 'Standard', 'Elite'][level]} tier services.` };
    }

    if (level === 1) standardUnits += raw.quantity;
    if (level === 2) eliteUnits += raw.quantity;

    // Quote-only services are reviewed manually and carry no credit cost here.
    const credits = service.quoteOnly ? 0 : service.prices[level] * raw.quantity;
    lines.push({ id: service.id, name: service.name, level, quantity: raw.quantity, credits });
  }

  if (!isWallet) {
    if (pkg.standardLimit !== undefined && standardUnits > pkg.standardLimit) {
      return { ok: false, error: `${pkg.name} allows at most ${pkg.standardLimit} Standard units.` };
    }
    if (pkg.eliteLimit !== undefined && eliteUnits > pkg.eliteLimit) {
      return { ok: false, error: `${pkg.name} allows at most ${pkg.eliteLimit} Elite units.` };
    }
  }

  const additions = Array.from(new Set(input.additions ?? []));
  for (const extra of additions) {
    if (!(extra in ADDITIONS_PRICING)) {
      return { ok: false, error: `Unknown add-on "${extra}".` };
    }
  }

  const servicesCredits = lines.reduce((sum, l) => sum + l.credits, 0);
  const additionsCredits = additions.reduce((sum, a) => sum + (ADDITIONS_PRICING[a] || 0), 0);
  const usedCredits = servicesCredits + additionsCredits;

  if (isWallet) {
    const walletBalance = typeof input.walletBalance === 'number' ? Math.max(0, input.walletBalance) : 0;
    const remainingWalletCredits = walletBalance - usedCredits;

    if (remainingWalletCredits < 0) {
      return {
        ok: false,
        error: `Selected services need ${usedCredits} CR but your Studio Wallet only has ${walletBalance} CR. Please top up or choose a package.`,
      };
    }

    return {
      ok: true,
      quote: {
        fundingSource: 'wallet',
        package: { ...pkg, credits: walletBalance },
        selections: lines,
        additions,
        servicesCredits,
        additionsCredits,
        usedCredits,
        packageCredits: 0,
        appliedWalletCredits: walletBalance,
        totalCredits: walletBalance,
        remainingCredits: remainingWalletCredits,
        remainingWalletCredits,
        priceUSD: 0,
      },
    };
  }

  // Package or Hybrid (Package + Applied Wallet Credits)
  const walletBalance = typeof input.walletBalance === 'number' ? Math.max(0, input.walletBalance) : 0;
  const shouldApplyWallet = input.applyWalletCredits ?? true;
  const appliedWalletCredits = shouldApplyWallet ? walletBalance : (input.appliedWalletCredits ?? 0);
  const totalCredits = pkg.credits + appliedWalletCredits;
  const remainingCredits = totalCredits - usedCredits;

  if (remainingCredits < 0) {
    return {
      ok: false,
      error: `Selected services need ${usedCredits} CR but your total available budget (${pkg.name} ${pkg.credits} CR${appliedWalletCredits > 0 ? ` + ${appliedWalletCredits} CR wallet` : ''}) is ${totalCredits} CR.`,
    };
  }

  return {
    ok: true,
    quote: {
      fundingSource: appliedWalletCredits > 0 ? 'hybrid' : 'package',
      package: pkg,
      selections: lines,
      additions,
      servicesCredits,
      additionsCredits,
      usedCredits,
      packageCredits: pkg.credits,
      appliedWalletCredits,
      totalCredits,
      remainingCredits,
      priceUSD: pkg.price,
    },
  };
}
