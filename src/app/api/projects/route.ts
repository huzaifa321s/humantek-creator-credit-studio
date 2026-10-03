import { NextRequest, NextResponse } from 'next/server';
import { getProjects, addProject, updateProjectStatus } from '@/lib/store';
import { PACKAGES } from '@/lib/catalog';
import { ProjectRecord } from '@/types';

export async function GET() {
  const projects = getProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      packageId,
      selections,
      additions,
      clientName,
      channelName,
      email,
      platform,
      style,
      colors,
      instructions,
      redeemCode,
      uploadedFiles,
    } = body;

    const selectedPackage = PACKAGES.find((p) => p.id === packageId);
    const packagePrice = selectedPackage?.price ?? 1500;
    const packageCredits = selectedPackage?.credits ?? 660;

    const usedCredits = (selections || []).reduce(
      (sum: number, s: { credits: number }) => sum + s.credits,
      0
    );

    const newProject: ProjectRecord = {
      id: projectId || `project-${Date.now()}`,
      projectCode: `HT-${Date.now().toString(36).toUpperCase()}-${(selectedPackage?.id || 'PKG').substring(0, 5).toUpperCase()}`,
      packageId: packageId || 'creator-forge',
      packageName: selectedPackage?.name || 'Creator Forge',
      packagePrice,
      packageCredits,
      usedCredits,
      remainingCredits: packageCredits - usedCredits,
      status: 'pending_review',
      paymentStatus: 'unpaid',
      clientName: clientName || 'Creator Client',
      channelName: channelName || '',
      email: email || '',
      platform: platform || '',
      style: style || '',
      colors: colors || '',
      instructions: instructions || '',
      redeemCode: redeemCode || '',
      additions: additions || [],
      selections: selections || [],
      uploadedFiles: uploadedFiles || [],
      createdAt: new Date().toISOString(),
    };

    addProject(newProject);

    return NextResponse.json({
      success: true,
      project: newProject,
      notificationStatus: 'sent',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit project';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, paymentStatus } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    const updated = updateProjectStatus(id, status, paymentStatus);
    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
