import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/lib/paypal';
import { addProject, addLedgerEntry } from '@/lib/store';
import { PACKAGES } from '@/lib/catalog';
import { ProjectRecord } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, projectData } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing PayPal Order ID' }, { status: 400 });
    }

    // 1. Capture with PayPal API
    const captureResult = await capturePayPalOrder(orderId);

    // 2. Prepare Project Record
    const selectedPackage = PACKAGES.find((p) => p.id === projectData.packageId);
    const packagePrice = selectedPackage?.price ?? 1500;
    const packageCredits = selectedPackage?.credits ?? 660;

    const usedCredits = (projectData.selections || []).reduce(
      (sum: number, s: { credits: number }) => sum + s.credits,
      0
    );

    const projectRecord: ProjectRecord = {
      id: projectData.projectId || `proj-${Date.now()}`,
      projectCode: `HT-${Date.now().toString(36).toUpperCase()}-${selectedPackage?.id.substring(0, 5).toUpperCase()}`,
      packageId: projectData.packageId,
      packageName: selectedPackage?.name || 'Creator Forge',
      packagePrice,
      packageCredits,
      usedCredits,
      remainingCredits: packageCredits - usedCredits,
      status: 'payment_confirmed',
      paymentStatus: 'paid',
      clientName: projectData.clientName || 'Anonymous Creator',
      channelName: projectData.channelName || '',
      email: projectData.email || 'guest@humantek.art',
      platform: projectData.platform || '',
      style: projectData.style || '',
      colors: projectData.colors || '',
      instructions: projectData.instructions || '',
      redeemCode: projectData.redeemCode || '',
      additions: projectData.additions || [],
      selections: projectData.selections || [],
      uploadedFiles: projectData.uploadedFiles || [],
      createdAt: new Date().toISOString(),
    };

    // 3. Save to store
    addProject(projectRecord);

    // 4. Record in Credit Ledger
    addLedgerEntry({
      id: `led-${Date.now()}`,
      userEmail: projectRecord.email,
      type: 'package_purchase',
      creditsDelta: packageCredits,
      usdAmount: packagePrice,
      referenceId: projectRecord.projectCode,
      description: `PayPal payment verified for ${projectRecord.packageName}`,
      createdAt: new Date().toISOString(),
    });

    if (usedCredits > 0) {
      addLedgerEntry({
        id: `led-${Date.now() + 1}`,
        userEmail: projectRecord.email,
        type: 'service_deduction',
        creditsDelta: -usedCredits,
        usdAmount: 0,
        referenceId: projectRecord.projectCode,
        description: `Credits allocated for order ${projectRecord.projectCode}`,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      capture: captureResult,
      project: projectRecord,
      message: 'Payment confirmed & project successfully logged into management queue!',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not capture PayPal order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
