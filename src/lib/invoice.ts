import { PACKAGES, TIER_NAMES } from '@/lib/catalog';
import { getProjectStatusLabel } from '@/lib/utils';
import type { ProjectRecord, ServiceTierLevel } from '@/types';
import type { ClientProjectView } from '@/lib/serializers/project';

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

/**
 * Generates and downloads a branded PDF Invoice / Receipt for any Studio Project.
 * Dynamically imports jsPDF on demand so page initial bundles stay lightweight.
 */
export async function downloadProjectInvoice(project: InvoiceProjectInput): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  const matchedPack = PACKAGES.find(
    (pkg) =>
      pkg.id === project.packageId ||
      pkg.name.toLowerCase() === (project.packageName || '').toLowerCase()
  );

  const isWalletFunded =
    project.fundingSource === 'wallet' ||
    project.paymentMethod === 'credits' ||
    project.packageId === 'studio-wallet';

  const isPaid = project.paymentStatus === 'paid' || isWalletFunded;
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
    : Number(project.packagePrice ?? matchedPack?.price ?? 0);

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
  // 1. Top Brand Header Banner
  // ---------------------------------------------------------------------------
  doc.setFillColor(24, 24, 27); // Zinc-900 dark header
  doc.rect(0, 0, pageWidth, 108, 'F');

  // Gold accent bar
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.rect(0, 105, pageWidth, 3, 'F');

  // Brand Title
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('HUMANTEK CREATOR CREDIT STUDIO', margin, 40);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(isPaid ? 'OFFICIAL RECEIPT & INVOICE' : 'PROJECT ORDER INVOICE', margin, 66);

  doc.setTextColor(161, 161, 170);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Creative Production Scope & Studio Credit Statement', margin, 84);

  // Right-aligned Invoice Meta in Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoiceNumber, pageWidth - margin, 42, { align: 'right' });

  doc.setTextColor(212, 212, 216);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Issued: ${createdDate}`, pageWidth - margin, 58, { align: 'right' });

  // Payment Status Pill inside Header
  const statusBadgeLabel = isRefunded
    ? 'REFUNDED'
    : isWalletFunded
      ? 'PAID · STUDIO WALLET'
      : isPaid
        ? 'PAID IN FULL'
        : 'PAYMENT PENDING';

  const badgeWidth = doc.getTextWidth(statusBadgeLabel) + 18;
  const badgeX = pageWidth - margin - badgeWidth;
  const badgeY = 68;

  if (isRefunded) {
    doc.setFillColor(225, 29, 72); // Rose-600
  } else if (isPaid) {
    doc.setFillColor(16, 185, 129); // Emerald-500
  } else {
    doc.setFillColor(245, 158, 11); // Amber-500
  }
  doc.roundedRect(badgeX, badgeY, badgeWidth, 18, 4, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(statusBadgeLabel, badgeX + badgeWidth / 2, badgeY + 12, { align: 'center' });

  // ---------------------------------------------------------------------------
  // 2. Client & Order Details Two-Column Cards
  // ---------------------------------------------------------------------------
  let y = 132;
  const cardHeight = 96;
  const colWidth = (contentWidth - 16) / 2;

  // Left Card: Client Details
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(margin, y, colWidth, cardHeight, 6, 6, 'FD');

  doc.setTextColor(113, 113, 122);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CLIENT & CREATOR PROFILE', margin + 14, y + 18);

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const clientDisplay = project.clientName || project.channelName || 'Creator Client';
  doc.text(clientDisplay.slice(0, 36), margin + 14, y + 36);

  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (project.email) {
    doc.text(`Email: ${project.email}`, margin + 14, y + 52);
  }
  doc.text(
    `Channel: ${(project.channelName || 'Not specified').slice(0, 34)}`,
    margin + 14,
    y + 67
  );
  doc.text(
    `Platform: ${project.platform || 'General'}  ·  Style: ${(project.style || 'Custom').slice(0, 18)}`,
    margin + 14,
    y + 82
  );

  // Right Card: Project & Package Summary
  const rightCardX = margin + colWidth + 16;
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(rightCardX, y, colWidth, cardHeight, 6, 6, 'FD');

  doc.setTextColor(113, 113, 122);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ORDER & PACKAGE SPECIFICATION', rightCardX + 14, y + 18);

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Project Code: ${project.projectCode}`, rightCardX + 14, y + 36);

  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Package: ${packageName}`, rightCardX + 14, y + 52);
  doc.text(
    `Funding: ${
      isWalletFunded
        ? 'Studio Wallet Credits'
        : project.paymentMethod === 'paypal' || isPaid
          ? 'PayPal / Online Checkout'
          : 'Manual Order Review'
    }`,
    rightCardX + 14,
    y + 67
  );
  doc.text(
    `Project Status: ${getProjectStatusLabel(project.status)}`,
    rightCardX + 14,
    y + 82
  );

  y += cardHeight + 24;

  // ---------------------------------------------------------------------------
  // 3. Itemized Service Scope Table
  // ---------------------------------------------------------------------------
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Itemized Creative Scope', margin, y);
  y += 10;

  // Table Header
  doc.setFillColor(244, 244, 245);
  doc.setDrawColor(228, 228, 231);
  doc.rect(margin, y, contentWidth, 24, 'FD');

  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('#', margin + 10, y + 15);
  doc.text('CREATIVE SERVICE', margin + 32, y + 15);
  doc.text('SCOPE TIER', margin + 270, y + 15);
  doc.text('QTY', margin + 365, y + 15, { align: 'right' });
  doc.text('UNIT CR', margin + 430, y + 15, { align: 'right' });
  doc.text('TOTAL CR', margin + contentWidth - 10, y + 15, { align: 'right' });

  y += 24;

  const selections = project.selections || [];
  if (selections.length === 0) {
    doc.setDrawColor(228, 228, 231);
    doc.rect(margin, y, contentWidth, 28, 'S');
    doc.setTextColor(113, 113, 122);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(
      `${packageName} — Custom Studio Production Scope`,
      margin + 32,
      y + 18
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`${usedCredits} CR`, margin + contentWidth - 10, y + 18, { align: 'right' });
    y += 28;
  } else {
    selections.forEach((item, idx) => {
      // Page break guard if many items
      if (y > pageHeight - 210) {
        doc.addPage();
        y = 50;
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
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(idx + 1), margin + 10, y + 15);

      doc.setTextColor(24, 24, 27);
      doc.setFont('helvetica', 'bold');
      doc.text(String(item.name || 'Studio Service').slice(0, 42), margin + 32, y + 15);

      doc.setTextColor(82, 82, 91);
      doc.setFont('helvetica', 'normal');
      doc.text(tierLabel, margin + 270, y + 15);

      doc.text(`${qty}x`, margin + 365, y + 15, { align: 'right' });
      doc.text(`${unitCr} CR`, margin + 430, y + 15, { align: 'right' });

      doc.setTextColor(24, 24, 27);
      doc.setFont('helvetica', 'bold');
      doc.text(`${totalCr} CR`, margin + contentWidth - 10, y + 15, { align: 'right' });

      y += rowHeight;
    });
  }

  // Optional Additions Row
  if (project.additions && project.additions.length > 0) {
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(253, 230, 138);
    doc.rect(margin, y, contentWidth, 24, 'FD');

    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      `Included Additions: ${project.additions.join(', ')}`,
      margin + 12,
      y + 15
    );
    y += 24;
  }

  y += 20;

  // ---------------------------------------------------------------------------
  // 4. Financial & Studio Credit Summary Box
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
  doc.roundedRect(summaryBoxX, y, summaryBoxWidth, summaryBoxHeight, 6, 6, 'FD');

  let sy = y + 20;

  if (!isWalletFunded) {
    doc.setTextColor(82, 82, 91);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Package Credits Included:', summaryBoxX + 14, sy);
    doc.setTextColor(24, 24, 27);
    doc.setFont('helvetica', 'bold');
    doc.text(`+${packageCredits} CR`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
    sy += 18;
  }

  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Project Scope Deduction:', summaryBoxX + 14, sy);
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.text(`-${usedCredits} CR`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
  sy += 18;

  if (!isWalletFunded) {
    doc.setTextColor(82, 82, 91);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Remaining Wallet Rollover:', summaryBoxX + 14, sy);
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.text(`${remainingCredits} CR`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
    sy += 16;
  }

  // Divider inside summary box
  doc.setDrawColor(228, 228, 231);
  doc.line(summaryBoxX + 14, sy - 4, summaryBoxX + summaryBoxWidth - 14, sy - 4);
  sy += 14;

  // Total USD Line
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    isWalletFunded
      ? 'Checkout Total:'
      : isPaid
        ? 'Total Paid (USD):'
        : 'Amount Due (USD):',
    summaryBoxX + 14,
    sy
  );

  doc.setFontSize(12);
  doc.text(
    isWalletFunded
      ? '$0.00 USD (Credits)'
      : `$${usdAmount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`,
    summaryBoxX + summaryBoxWidth - 14,
    sy,
    { align: 'right' }
  );

  // Left-side Notes / License Box next to Summary
  const notesWidth = contentWidth - summaryBoxWidth - 20;
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Included Studio Rights & Terms', margin, y + 16);

  doc.setTextColor(113, 113, 122);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const termsLines = doc.splitTextToSize(
    '• Commercial streaming & content monetization rights included.\n• 2–3 structured revision rounds included per service scope.\n• Unused package credits remain active in your Studio Wallet for 12 months.',
    notesWidth
  );
  doc.text(termsLines, margin, y + 32);

  // ---------------------------------------------------------------------------
  // 5. Bottom Page Footer
  // ---------------------------------------------------------------------------
  const footerY = pageHeight - 36;
  doc.setDrawColor(228, 228, 231);
  doc.line(margin, footerY - 14, pageWidth - margin, footerY - 14);

  doc.setTextColor(161, 161, 170);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Humantek Creator Credit Studio · Official Project & Credit Invoice',
    margin,
    footerY
  );
  doc.text(
    `Reference: ${project.projectCode} · ${invoiceNumber}`,
    pageWidth - margin,
    footerY,
    { align: 'right' }
  );

  const safeCode = (project.projectCode || project.id || 'PROJECT').replace(/[^a-zA-Z0-9_-]/g, '');
  doc.save(`Humantek-Invoice-${safeCode}.pdf`);
}
