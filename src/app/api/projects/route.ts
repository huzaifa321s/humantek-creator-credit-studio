import { NextRequest, NextResponse } from 'next/server';
import { getProjects, addProject, updateProjectStatus, getProjectById } from '@/lib/store';
import { computeOrderQuote } from '@/lib/pricing';
import { orderRequestSchema, patchProjectSchema, firstIssue } from '@/lib/validation';
import { buildProjectRecord } from '@/lib/orders';
import { getRequestUser } from '@/lib/auth';

/** Admins see every project; signed-in creators only see their own. */
export async function GET() {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const all = getProjects();
  const projects = user.isAdmin
    ? all
    : all.filter((p) => p.email.toLowerCase() === user.email);

  return NextResponse.json({ projects });
}

/**
 * Submit a project for studio review (unpaid). Credits and prices are always
 * recomputed server-side — any client-sent credit values are ignored.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = orderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  if (getProjectById(parsed.data.projectId)) {
    return NextResponse.json({ error: 'This project was already submitted.' }, { status: 409 });
  }

  const result = computeOrderQuote(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const project = buildProjectRecord(parsed.data, result.quote, {
    status: 'pending_review',
    paymentStatus: 'unpaid',
  });
  addProject(project);

  return NextResponse.json({ success: true, project, notificationStatus: 'sent' });
}

/** Status changes are restricted to studio admins. */
export async function PATCH(req: NextRequest) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = patchProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { id, status, paymentStatus } = parsed.data;
  const updated = updateProjectStatus(id, status, paymentStatus);
  if (!updated) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, project: updated });
}
