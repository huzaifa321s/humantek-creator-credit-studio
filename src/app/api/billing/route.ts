import { NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { serializeAdminProject } from '@/lib/serializers/project';
import { getPaymentPlatform, getPaymentReference } from '@/lib/payment-platform';

export const dynamic = 'force-dynamic';

const BILLING_SELECT =
  'id, user_id, project_code, package_id, package_name, package_price_usd, package_credits, total_credits, status, payment_status, payment_method, funding_source, applied_wallet_credits, client_name, channel_name, email, platform, style, colors, instructions, uploaded_files, reference_links, created_at, project_items(*), project_additions(*)';

/**
 * Billing history. Clients get their own invoices; Owner and Manager accounts get every
 * client's invoices (`?scope=all`). Viewer accounts are refused the studio-wide view.
 */
export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const wantsAll = new URL(req.url).searchParams.get('scope') === 'all';
  if (wantsAll && !(user.isAdmin && user.canManageProjects)) {
    return NextResponse.json(
      { error: 'Only Owner and Manager accounts can view all client billing.' },
      { status: 403 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ invoices: [] });
  }

  const adminClient = createAdminClient();
  let query = adminClient
    .from('projects')
    .select(BILLING_SELECT)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (!wantsAll) {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Billing] Failed to load invoices:', error);
    return NextResponse.json({ error: 'Failed to load billing history' }, { status: 500 });
  }

  const invoices = (data || []).map((row) => {
    const project = serializeAdminProject(row);
    return {
      ...project,
      paymentPlatform: getPaymentPlatform(project),
      paymentReference: getPaymentReference(project.instructions),
    };
  });

  return NextResponse.json({ invoices });
}
