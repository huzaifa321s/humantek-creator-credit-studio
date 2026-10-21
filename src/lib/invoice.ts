import { PACKAGES, TIER_NAMES, TOP_UP_OPTIONS } from '@/lib/catalog';
import { getProjectStatusLabel } from '@/lib/utils';
import { getPaymentPlatform, PAYMENT_PLATFORM_LABELS } from '@/lib/payment-platform';
import { resolvePaletteSwatches, hexToRgb } from '@/components/reui/color-picker';
import type { ProjectRecord, ServiceTierLevel } from '@/types';
import type { ClientProjectView } from '@/lib/serializers/project';

interface StudioFontSpec {
  fileName: string;
  url: string;
  family: 'Outfit' | 'GeistMono';
  style: 'normal' | 'bold';
}

const STUDIO_PDF_FONTS: StudioFontSpec[] = [
  { fileName: 'Outfit-Regular.ttf', url: '/fonts/Outfit-Regular.ttf', family: 'Outfit', style: 'normal' },
  { fileName: 'Outfit-Bold.ttf', url: '/fonts/Outfit-Bold.ttf', family: 'Outfit', style: 'bold' },
  { fileName: 'GeistMono-Regular.ttf', url: '/fonts/GeistMono-Regular.ttf', family: 'GeistMono', style: 'normal' },
  { fileName: 'GeistMono-Bold.ttf', url: '/fonts/GeistMono-Bold.ttf', family: 'GeistMono', style: 'bold' },
];

const fontBase64Cache = new Map<string, string>();
let jsPdfModulePromise: Promise<typeof import('jspdf')> | null = null;
let fontPayloadsPromise: Promise<boolean> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

let brandLogoPromise: Promise<string | null> | null = null;

/** Fetches the official Humantek Art logo (PNG, transparent) as a data URL for the PDF header. */
async function loadBrandLogoDataUrl(): Promise<string | null> {
  if (brandLogoPromise) return brandLogoPromise;

  if (typeof window === 'undefined') {
    brandLogoPromise = (async () => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'public', 'brand', 'logo-light.png');
        const buf = await fs.readFile(filePath);
        return `data:image/png;base64,${buf.toString('base64')}`;
      } catch (err) {
        console.warn('[Invoice] Server brand logo unavailable, using text emblem:', err);
        brandLogoPromise = null;
        return null;
      }
    })();
    return brandLogoPromise;
  }

  if (typeof fetch === 'undefined') {
    return Promise.resolve(null);
  }

  brandLogoPromise = fetch('/brand/logo-light.png', { cache: 'force-cache' })
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to load brand logo');
      return `data:image/png;base64,${arrayBufferToBase64(await res.arrayBuffer())}`;
    })
    .catch((err) => {
      console.warn('[Invoice] Brand logo unavailable, using text emblem:', err);
      brandLogoPromise = null;
      return null;
    });
  return brandLogoPromise;
}

function loadJsPdfModule(): Promise<typeof import('jspdf')> {
  if (!jsPdfModulePromise) {
    jsPdfModulePromise = import('jspdf');
  }
  return jsPdfModulePromise;
}

function loadStudioFontPayloads(): Promise<boolean> {
  if (fontPayloadsPromise) return fontPayloadsPromise;

  if (typeof window === 'undefined') {
    fontPayloadsPromise = (async () => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        await Promise.all(
          STUDIO_PDF_FONTS.map(async (spec) => {
            if (!fontBase64Cache.has(spec.fileName)) {
              const filePath = path.join(process.cwd(), 'public', 'fonts', spec.fileName);
              const buf = await fs.readFile(filePath);
              fontBase64Cache.set(spec.fileName, buf.toString('base64'));
            }
          })
        );
        return true;
      } catch (err) {
        console.warn('[Invoice] Server falling back to standard PDF fonts:', err);
        fontPayloadsPromise = null;
        return false;
      }
    })();
    return fontPayloadsPromise;
  }

  if (typeof fetch === 'undefined') {
    return Promise.resolve(false);
  }

  fontPayloadsPromise = Promise.all(
    STUDIO_PDF_FONTS.map(async (spec) => {
      if (!fontBase64Cache.has(spec.fileName)) {
        const res = await fetch(spec.url, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Failed to load font ${spec.fileName}`);
        const buf = await res.arrayBuffer();
        fontBase64Cache.set(spec.fileName, arrayBufferToBase64(buf));
      }
    })
  )
    .then(() => true)
    .catch((err) => {
      console.warn('[Invoice] Falling back to standard PDF fonts:', err);
      fontPayloadsPromise = null;
      return false;
    });
  return fontPayloadsPromise;
}

/**
 * Preloads the jsPDF bundle and subsetted Studio TTF fonts in the background
 * so clicking "Download Invoice" executes instantaneously (<50ms).
 */
export function preloadProjectInvoice(): void {
  if (typeof window === 'undefined') return;
  void loadJsPdfModule();
  void loadStudioFontPayloads();
}

/**
 * Registers the preloaded Studio web fonts (`Outfit` + `GeistMono`) into a jsPDF instance.
 */
async function registerStudioPdfFonts(
  doc: import('jspdf').jsPDF
): Promise<{ fontSans: string; fontMono: string }> {
  const ready = await loadStudioFontPayloads();
  if (!ready) {
    return { fontSans: 'helvetica', fontMono: 'helvetica' };
  }

  try {
    for (const spec of STUDIO_PDF_FONTS) {
      const b64 = fontBase64Cache.get(spec.fileName);
      if (!b64) throw new Error(`Missing cached font ${spec.fileName}`);
      doc.addFileToVFS(spec.fileName, b64);
      doc.addFont(spec.fileName, spec.family, spec.style);
    }
    return { fontSans: 'Outfit', fontMono: 'GeistMono' };
  } catch (err) {
    console.warn('[Invoice] Falling back to standard PDF fonts:', err);
    return { fontSans: 'helvetica', fontMono: 'helvetica' };
  }
}

function formatAdditionLabel(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (normalized === 'rush') {
    return 'Rush Priority Delivery (Express Production Queue)';
  }
  if (normalized in TOP_UP_OPTIONS) {
    const topup = TOP_UP_OPTIONS[normalized as keyof typeof TOP_UP_OPTIONS];
    return `${topup.label} (+${topup.credits} CR)`;
  }
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type InvoiceProjectInput =
  | ProjectRecord
  | ClientProjectView
  | {
      id: string;
      projectCode: string;
      packageId?: string;
      packageName?: string;
      packagePrice?: number;
      packageCredits?: number;
      usedCredits?: number;
      status: ProjectRecord['status'];
      paymentStatus?: ProjectRecord['paymentStatus'];
      paymentMethod?: string;
      fundingSource?: string;
      clientName?: string;
      email?: string;
      channelName?: string;
      platform?: string;
      style?: string;
      colors?: string;
      instructions?: string;
      selections?: {
        id: string;
        name: string;
        level?: ServiceTierLevel;
        quantity: number;
        credits: number;
      }[];
      additions?: string[];
      createdAt?: string;
    };

async function renderProjectInvoiceDocument(
  project: InvoiceProjectInput
): Promise<{ doc: import('jspdf').jsPDF; filename: string }> {
  const [{ jsPDF }] = await Promise.all([
    loadJsPdfModule(),
    loadStudioFontPayloads(),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const { fontSans, fontMono } = await registerStudioPdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  const matchedPack = PACKAGES.find(
    (pkg) =>
      pkg.id === project.packageId ||
      pkg.name.toLowerCase() === (project.packageName || '').toLowerCase()
  );

  const platform = getPaymentPlatform(project);
  const isWalletFunded =
    platform === 'wallet' &&
    (project.packageId === 'studio-wallet' || !matchedPack);

  const hasPayPalReceipt = Boolean(
    project.instructions?.includes('[PAYMENT RECEIVED via PayPal]')
  );

  const isPaid = project.paymentStatus === 'paid' || isWalletFunded || hasPayPalReceipt;
  const isRefunded = project.paymentStatus === 'refunded';

  const packageName =
    project.packageName ||
    matchedPack?.name ||
    (isWalletFunded ? 'Studio Wallet Scope' : 'Studio Custom Package');

  const packageCredits =
    project.packageCredits ||
    matchedPack?.credits ||
    project.usedCredits ||
    0;

  const usedCredits = Number(project.usedCredits) || 0;
  const remainingCredits = isWalletFunded
    ? 0
    : Math.max(0, packageCredits - usedCredits);

  const usdAmount = isWalletFunded
    ? 0
    : Number((project.packagePrice && project.packagePrice > 0 ? project.packagePrice : matchedPack?.price) ?? 0);

  const invoiceNumber = `INV-${project.projectCode || 'HT-STUDIO'}`;
  const createdDate = project.createdAt
    ? new Date(project.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });

  // ---------------------------------------------------------------------------
  // 1. Top Brand Header Banner (with signature Studio Gold ART Emblem)
  // ---------------------------------------------------------------------------
  doc.setFillColor(24, 24, 27); // Zinc-900 dark header
  doc.rect(0, 0, pageWidth, 112, 'F');

  // Gold accent bar
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.rect(0, 109, pageWidth, 3, 'F');

  const brandLogo = await loadBrandLogoDataUrl();
  if (brandLogo) {
    // Light-on-dark official logo drawn directly on the header (no background plate)
    doc.addImage(brandLogo, 'PNG', margin, 26, 58, 22.2, undefined, 'FAST');

    // Thin divider + softer, smaller label (matches the navbar)
    doc.setDrawColor(63, 63, 70); // Zinc-700
    doc.setLineWidth(0.8);
    doc.line(margin + 68, 29, margin + 68, 45);

    doc.setTextColor(251, 191, 36); // Amber-400
    doc.setFont(fontSans, 'bold');
    doc.setFontSize(6.5);
    doc.text('CREATOR CREDITS STUDIO', margin + 76, 39.5);
  } else {
    // Fallback: text emblem
    doc.setFillColor(251, 191, 36); // Amber-400
    doc.roundedRect(margin, 24, 26, 26, 7, 7, 'F');
    doc.setTextColor(9, 9, 11); // Zinc-950
    doc.setFont(fontSans, 'bold');
    doc.setFontSize(8.5);
    doc.text('ART', margin + 13, 40, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFont(fontSans, 'bold');
    doc.setFontSize(10.5);
    doc.text('Humantek Art', margin + 34, 35);

    doc.setTextColor(251, 191, 36); // Amber-400
    doc.setFont(fontSans, 'bold');
    doc.setFontSize(7.5);
    doc.text('CREATOR CREDITS STUDIO', margin + 34, 46);
  }

  // Main Invoice Document Title
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontSans, 'bold');
  doc.setFontSize(20);
  doc.text(isPaid ? 'OFFICIAL RECEIPT & INVOICE' : 'PROJECT ORDER INVOICE', margin, 74);

  doc.setTextColor(161, 161, 170);
  doc.setFont(fontSans, 'normal');
  doc.setFontSize(9.5);
  doc.text('Creative Services Summary & Studio Credits Statement', margin, 91);

  // Right-aligned Invoice Meta in Header (GeistMono for Invoice ID)
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontMono, 'bold');
  doc.setFontSize(10.5);
  doc.text(invoiceNumber, pageWidth - margin, 40, { align: 'right' });

  doc.setTextColor(212, 212, 216);
  doc.setFont(fontSans, 'normal');
  doc.setFontSize(9.5);
  doc.text(`Date: ${createdDate}`, pageWidth - margin, 56, { align: 'right' });

  // Payment Status Pill inside Header (matches Badge design system tokens)
  const statusBadgeLabel = isRefunded
    ? 'REFUNDED'
    : isWalletFunded
      ? 'PAID · STUDIO WALLET'
      : isPaid
        ? 'PAID IN FULL'
        : 'PAYMENT PENDING';

  doc.setFont(fontSans, 'bold');
  doc.setFontSize(8.5);
  const badgeWidth = doc.getTextWidth(statusBadgeLabel) + 18;
  const badgeX = pageWidth - margin - badgeWidth;
  const badgeY = 68;

  const isGoldPill = !isRefunded && (isWalletFunded || !isPaid);

  if (isRefunded) {
    doc.setFillColor(225, 29, 72); // Rose-600
  } else if (isWalletFunded) {
    doc.setFillColor(251, 191, 36); // Studio Gold (Amber-400) for Wallet Credits
  } else if (isPaid) {
    doc.setFillColor(16, 185, 129); // Emerald-500
  } else {
    doc.setFillColor(251, 191, 36); // Studio Gold (Amber-400) for Pending
  }
  doc.roundedRect(badgeX, badgeY, badgeWidth, 18, 9, 9, 'F');

  // High-contrast text: Zinc-950 on Gold/Amber pills, White on Emerald/Rose pills
  if (isGoldPill) {
    doc.setTextColor(9, 9, 11); // Zinc-950 (--primary-foreground)
  } else {
    doc.setTextColor(255, 255, 255);
  }
  doc.text(statusBadgeLabel, badgeX + badgeWidth / 2, badgeY + 12, { align: 'center' });

  // ---------------------------------------------------------------------------
  // 2. Client & Order Details Two-Column Cards
  // ---------------------------------------------------------------------------
  let y = 134;
  const cardHeight = 110;
  const colWidth = (contentWidth - 16) / 2;

  // Left Card: Client Details
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(margin, y, colWidth, cardHeight, 8, 8, 'FD');

  doc.setTextColor(113, 113, 122);
  doc.setFont(fontSans, 'bold');
  doc.setFontSize(8);
  doc.text('CLIENT DETAILS', margin + 14, y + 18);

  doc.setTextColor(24, 24, 27);
  doc.setFont(fontSans, 'bold');
  doc.setFontSize(11);
  const clientDisplay = project.clientName || project.channelName || 'Creator Client';
  doc.text(clientDisplay.slice(0, 36), margin + 14, y + 35);

  doc.setTextColor(82, 82, 91);
  doc.setFont(fontSans, 'normal');
  doc.setFontSize(8.8);
  if (project.email) {
    doc.text(`Email: ${project.email.slice(0, 36)}`, margin + 14, y + 50);
  } else {
    doc.text(
      `Channel: ${(project.channelName || 'Not specified').slice(0, 34)}`,
      margin + 14,
      y + 50
    );
  }
  doc.text(
    `Channel: ${(project.channelName || 'Not specified').slice(0, 22)}  ·  Platform: ${project.platform || 'General'}`,
    margin + 14,
    y + 65
  );
  doc.text(
    `Style: ${(project.style || 'Custom Art').slice(0, 30)}`,
    margin + 14,
    y + 80
  );

  // Color Palette Row with rendered Swatch Circles
  const colorLabel = (project.colors || 'Brand Colors').slice(0, 24);
  const swatches = resolvePaletteSwatches(project.colors).slice(0, 4);
  doc.text('Colors:', margin + 14, y + 95);

  let colorCursorX = margin + 14 + doc.getTextWidth('Color Palette:') + 6;
  for (const hex of swatches) {
    const rgb = hexToRgb(hex);
    if (rgb) {
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.setDrawColor(212, 212, 216);
      doc.circle(colorCursorX + 3.5, y + 92, 3.5, 'FD');
      colorCursorX += 9;
    }
  }
  doc.setTextColor(24, 24, 27);
  doc.setFont(fontSans, 'bold');
  doc.text(colorLabel, colorCursorX + (swatches.length > 0 ? 2 : 0), y + 95);

  // Right Card: Order Summary
  const rightCardX = margin + colWidth + 16;
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(rightCardX, y, colWidth, cardHeight, 8, 8, 'FD');

  doc.setTextColor(113, 113, 122);
  doc.setFont(fontSans, 'bold');
  doc.setFontSize(8);
  doc.text('ORDER SUMMARY', rightCardX + 14, y + 18);

  doc.setTextColor(82, 82, 91);
  doc.setFont(fontSans, 'bold');
  doc.setFontSize(10);
  doc.text('Project Code:', rightCardX + 14, y + 35);
  const codeLabelWidth = doc.getTextWidth('Project Code:') + 5;
  doc.setTextColor(24, 24, 27);
  doc.setFont(fontMono, 'bold');
  doc.setFontSize(10);
  doc.text(project.projectCode, rightCardX + 14 + codeLabelWidth, y + 35);

  doc.setTextColor(82, 82, 91);
  doc.setFont(fontSans, 'normal');
  doc.setFontSize(8.8);
  doc.text(`Package: ${packageName}`, rightCardX + 14, y + 52);
  doc.text(
    `Payment: ${
      isWalletFunded
        ? 'Studio Wallet Credits'
        : platform !== 'none'
          ? PAYMENT_PLATFORM_LABELS[platform]
          : 'Manual Order Review'
    }`,
    rightCardX + 14,
    y + 69
  );
  doc.text(
    `Status: ${getProjectStatusLabel(project.status)}`,
    rightCardX + 14,
    y + 86
  );

  y += cardHeight + 24;

  // ---------------------------------------------------------------------------
  // 3. Services & Deliverables Table (Beginner-friendly language)
  // ---------------------------------------------------------------------------
  doc.setTextColor(24, 24, 27);
  doc.setFont(fontSans, 'bold');
  doc.setFontSize(11);
  doc.text('Selected Services & Deliverables', margin, y);
  y += 10;

  const drawTableHeader = (topY: number): number => {
    doc.setFillColor(244, 244, 245);
    doc.setDrawColor(228, 228, 231);
    doc.rect(margin, topY, contentWidth, 24, 'FD');

    doc.setTextColor(82, 82, 91);
    doc.setFont(fontSans, 'bold');
    doc.setFontSize(8.5);
    doc.text('#', margin + 10, topY + 15);
    doc.text('SERVICE', margin + 32, topY + 15);
    doc.text('TIER', margin + 270, topY + 15);
    doc.text('QTY', margin + 365, topY + 15, { align: 'right' });
    doc.text('CREDITS EACH', margin + 435, topY + 15, { align: 'right' });
    doc.text('TOTAL', margin + contentWidth - 10, topY + 15, { align: 'right' });
    return topY + 24;
  };

  const selections = project.selections || [];
  const tableTop = y;
  const tableHeight =
    24 +
    (selections.length === 0 ? 28 : selections.length * 24) +
    (project.additions && project.additions.length > 0 ? 24 : 0);
  const tableFitsOnPage = tableTop + tableHeight <= pageHeight - 210;

  if (tableFitsOnPage) {
    doc.saveGraphicsState();
    doc.roundedRect(margin, tableTop, contentWidth, tableHeight, 8, 8, null);
    doc.clip();
    doc.discardPath();
  }

  y = drawTableHeader(y);

  if (selections.length === 0) {
    doc.setDrawColor(228, 228, 231);
    doc.rect(margin, y, contentWidth, 28, 'S');
    doc.setTextColor(113, 113, 122);
    doc.setFont(fontSans, 'normal');
    doc.setFontSize(9.5);
    doc.text(
      `${packageName} — Custom Studio Production Scope`,
      margin + 32,
      y + 18
    );
    doc.setFont(fontMono, 'bold');
    doc.text(`${usedCredits} CR`, margin + contentWidth - 10, y + 18, { align: 'right' });
    y += 28;
  } else {
    selections.forEach((item, idx) => {
      // Page break guard if many items — repeats table header on new page
      if (y > pageHeight - 210) {
        doc.addPage();
        y = drawTableHeader(48);
      }

      const rowHeight = 24;
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(235, 235, 238);
      doc.rect(margin, y, contentWidth, rowHeight, 'S');

      const qty = Math.max(1, Number(item.quantity) || 1);
      const totalCr = Number(item.credits) || 0;
      const unitCr = Math.round((totalCr / qty) * 10) / 10;
      const tierLabel =
        typeof item.level === 'number' && TIER_NAMES[item.level]
          ? TIER_NAMES[item.level]
          : 'Standard';

      doc.setTextColor(113, 113, 122);
      doc.setFont(fontMono, 'normal');
      doc.setFontSize(8.5);
      doc.text(String(idx + 1), margin + 10, y + 15);

      doc.setTextColor(24, 24, 27);
      doc.setFont(fontSans, 'bold');
      doc.setFontSize(9);
      doc.text(String(item.name || 'Studio Service').slice(0, 42), margin + 32, y + 15);

      doc.setTextColor(82, 82, 91);
      doc.setFont(fontSans, 'normal');
      doc.text(tierLabel, margin + 270, y + 15);

      doc.setFont(fontMono, 'normal');
      doc.setFontSize(8.5);
      doc.text(`${qty}x`, margin + 365, y + 15, { align: 'right' });
      doc.text(`${unitCr} CR`, margin + 430, y + 15, { align: 'right' });

      doc.setTextColor(24, 24, 27);
      doc.setFont(fontMono, 'bold');
      doc.text(`${totalCr} CR`, margin + contentWidth - 10, y + 15, { align: 'right' });

      y += rowHeight;
    });
  }

  // Optional Additions Row (formatted into human-readable Studio labels)
  if (project.additions && project.additions.length > 0) {
    const formattedAdditions = project.additions.map(formatAdditionLabel).join(' · ');
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(253, 230, 138);
    doc.rect(margin, y, contentWidth, 24, 'FD');

    doc.setTextColor(146, 64, 14);
    doc.setFont(fontSans, 'bold');
    doc.setFontSize(8.5);
    doc.text(
      `Extra Additions: ${formattedAdditions}`,
      margin + 12,
      y + 15
    );
    y += 24;
  }

  if (tableFitsOnPage) {
    doc.restoreGraphicsState();
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, tableTop, contentWidth, tableHeight, 8, 8, 'S');
    doc.setLineWidth(0.2);
  }

  y += 20;

  // ---------------------------------------------------------------------------
  // 4. Financial & Studio Credit Summary Box (matches rounded-xl / 8pt radius)
  // ---------------------------------------------------------------------------
  if (y > pageHeight - 180) {
    doc.addPage();
    y = 50;
  }

  const summaryBoxWidth = 250;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;
  const summaryBoxHeight = isWalletFunded ? 94 : 114;

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(212, 212, 216);
  doc.roundedRect(summaryBoxX, y, summaryBoxWidth, summaryBoxHeight, 8, 8, 'FD');

  let sy = y + 20;

  if (!isWalletFunded) {
    doc.setTextColor(82, 82, 91);
    doc.setFont(fontSans, 'normal');
    doc.setFontSize(9.5);
    doc.text('Credits in Package:', summaryBoxX + 14, sy);
    doc.setTextColor(24, 24, 27);
    doc.setFont(fontMono, 'bold');
    doc.setFontSize(9);
    doc.text(`+${packageCredits} CR`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
    sy += 18;
  }

  doc.setTextColor(82, 82, 91);
  doc.setFont(fontSans, 'normal');
  doc.setFontSize(9.5);
  doc.text('Credits Used for Services:', summaryBoxX + 14, sy);
  doc.setTextColor(24, 24, 27);
  doc.setFont(fontMono, 'bold');
  doc.setFontSize(9);
  doc.text(`-${usedCredits} CR`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
  sy += 18;

  if (!isWalletFunded) {
    doc.setTextColor(82, 82, 91);
    doc.setFont(fontSans, 'normal');
    doc.setFontSize(9.5);
    doc.text('Remaining in Your Wallet:', summaryBoxX + 14, sy);
    doc.setTextColor(16, 185, 129);
    doc.setFont(fontMono, 'bold');
    doc.setFontSize(9);
    doc.text(`${remainingCredits} CR`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
    sy += 16;
  }

  // Divider inside summary box
  doc.setDrawColor(228, 228, 231);
  doc.line(summaryBoxX + 14, sy - 4, summaryBoxX + summaryBoxWidth - 14, sy - 4);
  sy += 14;

  // Total USD Line
  doc.setTextColor(24, 24, 27);
  doc.setFont(fontSans, 'bold');
  doc.setFontSize(10.5);
  doc.text(
    isWalletFunded
      ? 'Total Due:'
      : isPaid
        ? 'Total Paid (USD):'
        : 'Total Due (USD):',
    summaryBoxX + 14,
    sy
  );

  doc.setFont(fontMono, 'bold');
  doc.setFontSize(11);
  doc.text(
    isWalletFunded
      ? '$0.00 USD (Paid with Credits)'
      : `$${usdAmount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`,
    summaryBoxX + summaryBoxWidth - 14,
    sy,
    { align: 'right' }
  );

  // Left-side Notes / License Box next to Summary (Beginner-friendly language)
  const notesWidth = contentWidth - summaryBoxWidth - 20;
  doc.setTextColor(24, 24, 27);
  doc.setFont(fontSans, 'bold');
  doc.setFontSize(9.5);
  doc.text('What is Included in Your Order', margin, y + 16);

  const platformLabel = project.platform || 'General';
  const hasElite = selections.some((s) => s.level === 2);
  const hasStandard = selections.some((s) => s.level === 1 || (s.level === undefined && selections.length > 0));
  const hasBasic = selections.some((s) => s.level === 0);
  const hasRush = Boolean(project.additions?.some((a) => a.trim().toLowerCase() === 'rush'));

  let scopeRightsBullet: string;
  if (hasElite && (hasStandard || hasBasic)) {
    scopeRightsBullet = `• Deliverables: High-res source files, commercial rights & ready-to-use exports for ${platformLabel}.`;
  } else if (hasElite) {
    scopeRightsBullet = `• Deliverables: 3 concepts, layered source files, commercial rights & priority review for ${platformLabel}.`;
  } else if (hasStandard && hasBasic) {
    scopeRightsBullet = `• Deliverables: 2 concepts, source files, all platform sizes & ready-to-use exports for ${platformLabel}.`;
  } else if (hasStandard || selections.length === 0) {
    scopeRightsBullet = `• Deliverables: 2 concepts, layered source files & ready-to-use exports for ${platformLabel}.`;
  } else {
    scopeRightsBullet = `• Deliverables: Final high-quality exports ready to publish on ${platformLabel}.`;
  }

  let revisionsBullet: string;
  if (hasElite && (hasStandard || hasBasic)) {
    revisionsBullet = `• Revisions: 3 revision rounds for Elite items & 2 rounds for Standard items${hasRush ? ' (Rush priority queue active).' : '.'}`;
  } else if (hasElite) {
    revisionsBullet = `• Revisions: 3 structured revision rounds with fast turnarounds${hasRush ? ' (Rush priority queue active).' : '.'}`;
  } else {
    revisionsBullet = `• Revisions: 2 structured revision rounds included per service${hasRush ? ' (Rush priority queue active).' : '.'}`;
  }

  let walletBullet: string;
  if (isRefunded) {
    walletBullet = `• Credits: Order was refunded (${usedCredits} CR returned to your Studio Wallet).`;
  } else if (isWalletFunded) {
    walletBullet = `• Credits: ${usedCredits} CR deducted directly from your Studio Wallet balance.`;
  } else if (!isPaid) {
    walletBullet = `• Credits: ${packageCredits} CR will be added to your Studio Wallet once payment is complete.`;
  } else if (remainingCredits > 0) {
    walletBullet = `• Credits rollover: ${remainingCredits} unused credits stay in your Studio Wallet for your next project.`;
  } else {
    walletBullet = `• Credits: All ${packageCredits} package credits were used for these services.`;
  }

  doc.setTextColor(113, 113, 122);
  doc.setFont(fontSans, 'normal');
  doc.setFontSize(8.5);
  const termsLines = doc.splitTextToSize(
    `${scopeRightsBullet}\n${revisionsBullet}\n${walletBullet}`,
    notesWidth
  );
  doc.text(termsLines, margin, y + 31);

  // ---------------------------------------------------------------------------
  // 5. Bottom Page Footer (rendered across all pages with Page X of Y)
  // ---------------------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  const footerY = pageHeight - 36;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    doc.setDrawColor(228, 228, 231);
    doc.line(margin, footerY - 14, pageWidth - margin, footerY - 14);

    doc.setTextColor(161, 161, 170);
    doc.setFont(fontSans, 'normal');
    doc.setFontSize(8);
    doc.text(
      'Humantek Art · Creator Credits Studio · Official Project & Credit Invoice',
      margin,
      footerY
    );
    doc.setFont(fontMono, 'normal');
    doc.setFontSize(7.5);
    doc.text(
      `Reference: ${project.projectCode} · ${invoiceNumber}${totalPages > 1 ? ` · Page ${pageNum} of ${totalPages}` : ''}`,
      pageWidth - margin,
      footerY,
      { align: 'right' }
    );
  }

  const safeCode = (project.projectCode || project.id || 'PROJECT').replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `Humantek-Invoice-${safeCode}.pdf`;
  return { doc, filename };
}

/**
 * Generates and downloads a branded PDF Invoice / Receipt for any Studio Project in the browser.
 */
export async function downloadProjectInvoice(project: InvoiceProjectInput): Promise<void> {
  const { doc, filename } = await renderProjectInvoiceDocument(project);
  doc.save(filename);
}

/**
 * Generates a branded PDF Invoice / Receipt as a binary ArrayBuffer (for email attachments or API downloads).
 */
export async function generateProjectInvoicePdfBytes(
  project: InvoiceProjectInput
): Promise<{ filename: string; content: ArrayBuffer }> {
  const { doc, filename } = await renderProjectInvoiceDocument(project);
  return {
    filename,
    content: doc.output('arraybuffer'),
  };
}
