import { NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { serializeAdminProject, serializeClientProject } from '@/lib/serializers/project';
import { getPaymentPlatform, getPaymentReference } from '@/lib/payment-platform';
import { PACKAGES } from '@/lib/catalog';
import { getProjects } from '@/lib/store';

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

  const pkgById = new Map(PACKAGES.map((p) => [p.id, p]));

  if (!isSupabaseConfigured() || user.isDevFallback) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ invoices: [] });
    }
    const devProjects = getProjects().filter((p) =>
      wantsAll ? true : p.userId === user.id || p.email?.toLowerCase() === user.email?.toLowerCase()
    );
    const invoices = devProjects.map((row) => {
      const project = wantsAll ? serializeAdminProject(row) : serializeClientProject(row);
      const matchedPkg = pkgById.get(project.packageId);
      const isPureWallet =
        project.packageId === 'studio-wallet' ||
        (project.fundingSource === 'wallet' && !matchedPkg);
      const packagePrice =
        project.packagePrice > 0
          ? project.packagePrice
          : !isPureWallet && matchedPkg
            ? matchedPkg.price
            : 0;
      const packageCredits =
        (project.packageCredits ?? 0) > 0
          ? (project.packageCredits ?? 0)
          : !isPureWallet && matchedPkg
            ? matchedPkg.credits
            : project.usedCredits;

      return {
        ...project,
        packagePrice,
        packageCredits,
        paymentPlatform: getPaymentPlatform(project),
        paymentReference: getPaymentReference(project.instructions),
      };
    });
    return NextResponse.json({ invoices });
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
    const project = wantsAll ? serializeAdminProject(row) : serializeClientProject(row);
    const matchedPkg = pkgById.get(project.packageId);
    const isPureWallet =
      project.packageId === 'studio-wallet' ||
      (project.fundingSource === 'wallet' && !matchedPkg);

    const packagePrice =
      project.packagePrice > 0
        ? project.packagePrice
        : !isPureWallet && matchedPkg
          ? matchedPkg.price
          : 0;
    const packageCredits =
      (project.packageCredits ?? 0) > 0
        ? (project.packageCredits ?? 0)
        : !isPureWallet && matchedPkg
          ? matchedPkg.credits
          : project.usedCredits;

    const paymentPlatform = getPaymentPlatform({
      ...project,
      // If a named package was purchased via server-side PayPal capture, its RPC stored funding_source='wallet'
      // and payment_method='credits' even though the package was purchased via PayPal.
      paymentMethod:
        project.paymentMethod === 'credits' && matchedPkg && project.packageId !== 'studio-wallet' && project.packagePrice === 0
          ? 'paypal'
          : project.paymentMethod,
    });

    return {
      ...project,
      packagePrice,
      packageCredits,
      paymentPlatform,
      paymentReference: getPaymentReference(project.instructions),
    };
  });

  return NextResponse.json({ invoices });
}
