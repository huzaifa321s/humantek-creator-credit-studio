import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { orderRequestSchema, patchProjectSchema, firstIssue } from '@/lib/validation';
import type { ProjectRecord, ServiceTierLevel } from '@/types';
import {
  getProjects,
  addProject,
  updateProjectStatus,
  getProjectById,
  getUserBalance,
  recordWalletFundedProject,
} from '@/lib/store';
import { computeOrderQuote } from '@/lib/pricing';
import { buildProjectRecord } from '@/lib/orders';
import { PACKAGES } from '@/lib/catalog';

function formatDbProject(p: any): ProjectRecord {
  return {
    id: p.id,
    projectCode: p.project_code,
    packageId: p.package_id || 'studio-wallet',
    packageName: p.package_name || '',
    packagePrice: Number(p.package_price_usd) || 0,
    packageCredits: p.package_credits || 0,
    usedCredits: p.total_credits || 0,
    remainingCredits: Math.max(0, (p.package_credits || 0) - (p.total_credits || 0)),
    status: p.status,
    paymentStatus: p.payment_status,
    paymentMethod: p.payment_method,
    fundingSource: p.funding_source,
    appliedWalletCredits: p.applied_wallet_credits || 0,
    clientName: p.client_name,
    channelName: p.channel_name || '',
    email: p.email,
    platform: p.platform || '',
    style: p.style || '',
    colors: p.colors || '',
    instructions: p.instructions || '',
    uploadedFiles: Array.isArray(p.uploaded_files) ? p.uploaded_files : [],
    lastMessageAt: p.last_message_at || null,
    lastMessagePreview: p.last_message_preview || null,
    additions: (p.project_additions || []).map((a: any) => a.name),
    selections: (p.project_items || []).map((i: any) => ({
      id: i.service_id,
      name: i.service_name,
      level: i.tier_level as ServiceTierLevel,
      quantity: i.quantity,
      credits: i.total_credits,
    })),
    createdAt: p.created_at,
  };
}

/** Admins see every project; signed-in creators only see their own. */
export async function GET() {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 1. Production / Real Supabase Path
  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    try {
      const adminClient = createAdminClient();
      let query = adminClient
        .from('projects')
        .select('*, project_items(*), project_additions(*)')
        .order('created_at', { ascending: false });

      if (!user.isAdmin) {
        query = query.or(`user_id.eq.${user.id},email.ilike.${user.email}`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error retrieving projects from database:', error);
        return NextResponse.json({ error: 'Failed to retrieve projects' }, { status: 500 });
      }

      const projects = (data || []).map(formatDbProject);
      return NextResponse.json({ projects });
    } catch (err) {
      console.error('Database query exception in GET /api/projects:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // 2. Dev Mock Fallback
  const all = getProjects();
  const DEMO_EMAILS = ['creator@humantek.art', 'kira@example.com'];
  const projects = user.isAdmin
    ? all
    : all.filter((p) => {
        const pEmail = (p.email || '').toLowerCase().trim();
        if (pEmail === user.email) return true;
        if (DEMO_EMAILS.includes(user.email) && DEMO_EMAILS.includes(pEmail)) return true;
        return false;
      });

  return NextResponse.json({ projects });
}

/**
 * Submit a project for studio review (unpaid) or fund instantly via Studio Wallet credits.
 * Credits and prices are always recomputed server-side in PostgreSQL — client prices are never trusted.
 */
export async function POST(req: NextRequest) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

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

  // 1. Production / Real Supabase Path (Atomic PostgreSQL Pipeline)
  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    try {
      const adminClient = createAdminClient();

      const pkgCodeMap: Record<string, string> = {
        'creator-forge': 'FORGE',
        'studio-momentum': 'MOMENTUM',
        'signature-collective': 'SIGNATURE',
        'studio-wallet': 'WALLET',
      };
      const pkgCode = pkgCodeMap[parsed.data.packageId] || 'STUDIO';
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const projectCode = `HT-${randomDigits}-${pkgCode}`;

      // A. Unpaid Project Submission (Manual Agency Review / PO approval requested)
      if (parsed.data.paymentStatus === 'unpaid') {
        const pkg = PACKAGES.find((p) => p.id === parsed.data.packageId) || {
          name: parsed.data.packageId,
          price: 0,
          credits: 0,
        };

        const totalCreditsRequired = (parsed.data.selections || []).reduce(
          (sum: number, s: any) => sum + (s.credits || 0),
          0
        );

        const { data: insertedProj, error: insertErr } = await adminClient
          .from('projects')
          .insert({
            id: parsed.data.projectId,
            project_code: projectCode,
            user_id: user.id,
            package_id: parsed.data.packageId,
            package_name: pkg.name,
            funding_source: 'package',
            status: 'pending_review',
            payment_status: 'unpaid',
            payment_method: 'unpaid',
            package_price_usd: pkg.price,
            package_credits: pkg.credits,
            total_credits: totalCreditsRequired,
            applied_wallet_credits: 0,
            client_name: parsed.data.clientName,
            channel_name: parsed.data.channelName || '',
            email: user.email,
            platform: parsed.data.platform || '',
            style: parsed.data.style || '',
            colors: parsed.data.colors || '',
            instructions: parsed.data.instructions || '',
            uploaded_files: parsed.data.uploadedFiles || [],
            idempotency_key: parsed.data.projectId,
          })
          .select('*, project_items(*), project_additions(*)')
          .single();

        if (insertErr) {
          console.error('Failed to insert unpaid project:', insertErr);
          return NextResponse.json({ error: 'Failed to submit project for review' }, { status: 500 });
        }

        // Insert project items
        if (parsed.data.selections && parsed.data.selections.length > 0) {
          const itemsToInsert = parsed.data.selections.map((sel: any) => ({
            project_id: parsed.data.projectId,
            service_id: sel.id,
            service_name: sel.name,
            tier_level: sel.level,
            quantity: sel.quantity,
            unit_credits: Math.round(sel.credits / Math.max(1, sel.quantity)),
            total_credits: sel.credits,
          }));
          await adminClient.from('project_items').insert(itemsToInsert);
        }

        // Insert additions
        if (parsed.data.additions && parsed.data.additions.length > 0) {
          const additionsToInsert = parsed.data.additions.map((addName: string) => ({
            project_id: parsed.data.projectId,
            name: addName,
            unit_credits: 0,
          }));
          await adminClient.from('project_additions').insert(additionsToInsert);
        }

        // Record initial status history
        await adminClient.from('project_status_history').insert({
          project_id: parsed.data.projectId,
          old_status: null,
          new_status: 'pending_review',
          changed_by: user.id,
          reason: 'Client submitted brief for manual agency review (no upfront payment)',
        });

        const { data: freshProj } = await adminClient
          .from('projects')
          .select('*, project_items(*), project_additions(*)')
          .eq('id', parsed.data.projectId)
          .single();

        return NextResponse.json({
          success: true,
          project: freshProj ? formatDbProject(freshProj) : null,
          fundingSource: 'package',
          notificationStatus: 'sent',
          message: 'Project brief submitted for manual studio review!',
        });
      }

      // B. Paid Settlement via Studio Wallet Credits
      const { data: rpcRes, error: rpcErr } = await adminClient.rpc('create_project_and_spend_credits', {
        p_project_id: parsed.data.projectId,
        p_project_code: projectCode,
        p_user_id: user.id,
        p_package_id: parsed.data.packageId,
        p_funding_source: 'wallet',
        p_client_name: parsed.data.clientName,
        p_channel_name: parsed.data.channelName || '',
        p_email: user.email,
        p_platform: parsed.data.platform || '',
        p_style: parsed.data.style || '',
        p_colors: parsed.data.colors || '',
        p_instructions: parsed.data.instructions || '',
        p_uploaded_files: parsed.data.uploadedFiles || [],
        p_selections: parsed.data.selections,
        p_additions: parsed.data.additions || [],
        p_idempotency_key: parsed.data.projectId,
      });

      if (rpcErr) {
        if (rpcErr.message.includes('insufficient_credits')) {
          return NextResponse.json(
            { error: 'Insufficient wallet credits. Please redeem a promo code or top up your balance.' },
            { status: 400 }
          );
        }
        if (rpcErr.message.includes('standard_tier_limit_exceeded')) {
          return NextResponse.json({ error: 'This package allows a maximum of 2 Standard tier services.' }, { status: 422 });
        }
        if (rpcErr.message.includes('elite_tier_limit_exceeded')) {
          return NextResponse.json({ error: 'This package allows a maximum of 2 Elite tier services.' }, { status: 422 });
        }
        if (rpcErr.message.includes('tier_exceeds_package_level')) {
          return NextResponse.json({ error: 'Selected service tier exceeds the maximum level of this package.' }, { status: 422 });
        }
        if (rpcErr.message.includes('credits_exceed_package_budget')) {
          return NextResponse.json({ error: 'Total credits required exceed the package budget.' }, { status: 422 });
        }
        return NextResponse.json({ error: rpcErr.message }, { status: 400 });
      }

      const { data: projRow } = await adminClient
        .from('projects')
        .select('*, project_items(*), project_additions(*)')
        .eq('id', parsed.data.projectId)
        .single();

      const project = projRow ? formatDbProject(projRow) : null;

      return NextResponse.json({
        success: true,
        project,
        fundingSource: parsed.data.fundingSource,
        newWalletBalance: rpcRes.new_wallet_balance,
        notificationStatus: 'sent',
        message: parsed.data.fundingSource === 'wallet' ? 'Project launched successfully using Studio Wallet credits!' : undefined,
      });
    } catch (err) {
      console.error('Error processing project in PostgreSQL pipeline:', err);
      return NextResponse.json({ error: 'Failed to process project order' }, { status: 500 });
    }
  }

  // 2. Dev Mock Fallback
  if (getProjectById(parsed.data.projectId)) {
    return NextResponse.json({ error: 'This project was already submitted.' }, { status: 409 });
  }

  const isWalletFunding = parsed.data.fundingSource === 'wallet' || parsed.data.packageId === 'studio-wallet';
  const normEmail = (parsed.data.email || 'kira@example.com').toLowerCase().trim();
  const serverBalance = getUserBalance(normEmail);

  const quoteInput = {
    ...parsed.data,
    email: normEmail,
    walletBalance: serverBalance,
  };

  const result = computeOrderQuote(quoteInput);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  if (isWalletFunding) {
    if (serverBalance < result.quote.usedCredits) {
      return NextResponse.json(
        {
          error: `Insufficient wallet balance. You have ${serverBalance} CR but this project requires ${result.quote.usedCredits} CR. Please top up or choose a package.`,
        },
        { status: 400 }
      );
    }

    const project = buildProjectRecord(parsed.data, result.quote, {
      status: 'pending_review',
      paymentStatus: 'paid',
    });
    project.paymentMethod = 'credits';
    project.fundingSource = 'wallet';
    project.packagePrice = 0;

    recordWalletFundedProject(project);

    return NextResponse.json({
      success: true,
      project,
      fundingSource: 'wallet',
      newWalletBalance: getUserBalance(normEmail),
      notificationStatus: 'sent',
      message: 'Project launched successfully using Studio Wallet credits!',
    });
  }

  const project = buildProjectRecord(parsed.data, result.quote, {
    status: 'pending_review',
    paymentStatus: 'unpaid',
  });
  project.paymentMethod = 'unpaid';
  project.fundingSource = 'package';
  addProject(project);

  return NextResponse.json({ success: true, project, notificationStatus: 'sent' });
}

/** Status changes: cancellation allowed by project owner or admin; other changes restricted to studio admins. */
export async function PATCH(req: NextRequest) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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

  // 1. Production / Real Supabase Path
  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    const adminClient = createAdminClient();

    // Cancellation: can be initiated by project owner or admin
    if (status === 'cancelled') {
      const { error: cancelErr } = await adminClient.rpc('cancel_project_and_refund', {
        p_project_id: id,
        p_user_id: user.id,
        p_reason: 'Status updated to cancelled',
      });

      if (cancelErr) {
        if (cancelErr.message.includes('unauthorized')) {
          return NextResponse.json({ error: 'You are not authorized to cancel this project.' }, { status: 403 });
        }
        return NextResponse.json({ error: cancelErr.message }, { status: 400 });
      }

      const { data: updatedProj } = await adminClient
        .from('projects')
        .select('*, project_items(*), project_additions(*)')
        .eq('id', id)
        .single();

      return NextResponse.json({ success: true, project: formatDbProject(updatedProj) });
    }

    // Other status updates strictly require admin access
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { data: rpcRes, error: rpcErr } = await adminClient.rpc('update_project_status', {
      p_project_id: id,
      p_new_status: status,
      p_notes: `Status updated via admin console by ${user.email}`,
      p_admin_id: user.id,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    if (paymentStatus) {
      await adminClient.from('projects').update({ payment_status: paymentStatus }).eq('id', id);
    }

    const { data: updatedProj } = await adminClient
      .from('projects')
      .select('*, project_items(*), project_additions(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ success: true, project: formatDbProject(updatedProj) });
  }

  // 2. Dev Mock Fallback
  if (!user.isAdmin && status !== 'cancelled') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const updated = updateProjectStatus(id, status as any, paymentStatus);
  if (!updated) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, project: updated });
}
