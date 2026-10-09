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
import { buildProjectRecord, formatDbProject } from '@/lib/orders';
import { PACKAGES, SERVICES } from '@/lib/catalog';




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
        query = query.eq('user_id', user.id);
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
  const projects = user.isAdmin
    ? all
    : all.filter((p) => (p.userId ? p.userId === user.id : false));

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

  // Administrators cannot create client projects for themselves
  if (user.isAdmin) {
    return NextResponse.json(
      { error: 'Administrators cannot create client projects. Please use the Management Console to oversee client projects.' },
      { status: 403 }
    );
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

  // Validate package against official catalog
  const isValidPackage =
    parsed.data.packageId === 'studio-wallet' ||
    PACKAGES.some((p) => p.id === parsed.data.packageId);
  if (!isValidPackage) {
    return NextResponse.json(
      { error: `Invalid package "${parsed.data.packageId}". Please select a valid package from the catalog.` },
      { status: 400 }
    );
  }

  // Validate service selections against official catalog
  const validServices = new Map(SERVICES.map((s) => [s.id, s]));
  for (const sel of parsed.data.selections) {
    const serviceDef = validServices.get(sel.id);
    if (!serviceDef) {
      return NextResponse.json(
        { error: `Invalid service selection: "${sel.id}" does not exist in the catalog.` },
        { status: 400 }
      );
    }
    if (!sel.quantity || sel.quantity < 1 || sel.quantity > 50) {
      return NextResponse.json(
        { error: `Invalid quantity (${sel.quantity}) for service "${serviceDef.name || sel.id}". Must be between 1 and 50.` },
        { status: 400 }
      );
    }
    if (sel.level < 0 || sel.level > 2) {
      return NextResponse.json(
        { error: `Invalid tier level (${sel.level}) for service "${serviceDef.name || sel.id}".` },
        { status: 400 }
      );
    }
  }

  // Resolve project owner display name and email exclusively from authenticated profile & session.
  // Any clientName or email passed in the request body is strictly ignored for security.
  let ownerName = 'Creator';
  let ownerEmail = user.email.toLowerCase().trim();

  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    try {
      const adminClient = createAdminClient();
      const { data: profile } = await adminClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.full_name?.trim()) {
          ownerName = profile.full_name.trim();
        } else if (profile.email) {
          ownerName = profile.email.split('@')[0];
        }
        if (profile.email) {
          ownerEmail = profile.email.toLowerCase().trim();
        }
      }
    } catch (e) {
      console.warn('Could not load profile for project owner:', e);
    }
  } else {
    ownerName = user.email.split('@')[0] || 'Creator';
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

        // Check if unpaid project was already submitted (idempotency replay)
        const { data: existingUnpaid } = await adminClient
          .from('projects')
          .select('*, project_items(*), project_additions(*)')
          .or(`id.eq.${parsed.data.projectId},idempotency_key.eq.${parsed.data.projectId}`)
          .maybeSingle();

        if (existingUnpaid) {
          if (existingUnpaid.user_id !== user.id && !user.isAdmin) {
            return NextResponse.json({ error: 'Idempotency key belongs to another user' }, { status: 403 });
          }
          return NextResponse.json({
            success: true,
            replayed: true,
            project: formatDbProject(existingUnpaid),
            fundingSource: existingUnpaid.funding_source,
            notificationStatus: 'sent',
            message: 'Project brief already submitted for manual studio review!',
          });
        }

        const { data: insertedProj, error: insertErr } = await adminClient

          .from('projects')
          .insert({
            id: parsed.data.projectId,
            project_code: projectCode,
            user_id: user.id,
            package_id: parsed.data.packageId,
            package_name: pkg.name,
            funding_source: parsed.data.fundingSource || 'wallet',
            status: 'pending_review',
            payment_status: 'unpaid',
            payment_method: 'unpaid',
            package_price_usd: pkg.price || 0,
            package_credits: 0,
            total_credits: totalCreditsRequired,
            applied_wallet_credits: 0,
            client_name: ownerName,
            channel_name: parsed.data.channelName || '',
            email: ownerEmail,
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
      // Pre-check for existing project with this idempotency key
      const { data: existingWalletProj } = await adminClient
        .from('projects')
        .select('*, project_items(*), project_additions(*)')
        .or(`id.eq.${parsed.data.projectId},idempotency_key.eq.${parsed.data.projectId}`)
        .maybeSingle();

      if (existingWalletProj) {
        if (existingWalletProj.user_id !== user.id && !user.isAdmin) {
          return NextResponse.json({ error: 'Idempotency key belongs to another user' }, { status: 403 });
        }
        return NextResponse.json({
          success: true,
          replayed: true,
          project: formatDbProject(existingWalletProj),
          fundingSource: existingWalletProj.funding_source,
          notificationStatus: 'sent',
          message: 'Project already submitted.',
        });
      }

      const { data: rpcRes, error: rpcErr } = await adminClient.rpc('create_project_and_spend_credits', {
        p_project_id: parsed.data.projectId,
        p_project_code: projectCode,
        p_user_id: user.id,
        p_package_id: parsed.data.packageId,
        p_funding_source: 'wallet',
        p_client_name: ownerName,
        p_channel_name: parsed.data.channelName || '',
        p_email: ownerEmail,
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
        if (
          rpcErr.message.includes('duplicate key') ||
          rpcErr.message.includes('unique constraint') ||
          rpcErr.message.includes('idempotency_key')
        ) {
          const { data: committedProj } = await adminClient
            .from('projects')
            .select('*, project_items(*), project_additions(*)')
            .eq('id', parsed.data.projectId)
            .maybeSingle();

          if (committedProj) {
            return NextResponse.json({
              success: true,
              replayed: true,
              project: formatDbProject(committedProj),
              fundingSource: committedProj.funding_source,
              notificationStatus: 'sent',
              message: 'Project already submitted.',
            });
          }
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
        replayed: Boolean(rpcRes?.replayed),
        project,
        fundingSource: parsed.data.fundingSource,
        newWalletBalance: rpcRes?.new_wallet_balance,
        notificationStatus: 'sent',
        message: parsed.data.fundingSource === 'wallet' ? 'Project launched successfully using Studio Wallet credits!' : undefined,
      });
    } catch (err) {
      console.error('Error processing project in PostgreSQL pipeline:', err);
      return NextResponse.json({ error: 'Failed to process project order' }, { status: 500 });
    }
  }

  // 2. Dev Mock Fallback
  const existingDevProj = getProjectById(parsed.data.projectId);
  if (existingDevProj) {
    if (existingDevProj.userId && existingDevProj.userId !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: 'Idempotency key belongs to another user' }, { status: 403 });
    }
    return NextResponse.json({
      success: true,
      replayed: true,
      project: existingDevProj,
      message: 'Project already submitted.',
    });
  }


  const isWalletFunding = parsed.data.fundingSource === 'wallet' || parsed.data.packageId === 'studio-wallet';
  const normEmail = ownerEmail;
  const serverBalance = getUserBalance(normEmail);

  const quoteInput = {
    ...parsed.data,
    clientName: ownerName,
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

    const project = buildProjectRecord(
      {
        ...parsed.data,
        clientName: ownerName,
        email: normEmail,
      },
      result.quote,
      {
        status: 'pending_review',
        paymentStatus: 'paid',
      }
    );
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

  const project = buildProjectRecord(
    {
      ...parsed.data,
      clientName: ownerName,
      email: normEmail,
    },
    result.quote,
    {
      status: 'pending_review',
      paymentStatus: 'unpaid',
    }
  );
  project.paymentMethod = 'unpaid';
  project.fundingSource = parsed.data.fundingSource || 'wallet';
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
      if (rpcErr.message.includes('unpaid_project_cannot_enter_production')) {
        return NextResponse.json(
          { error: 'Cannot start production: Project has not been paid. Payment confirmation required before entering production.' },
          { status: 400 }
        );
      }
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

  const devTargetProj = getProjectById(id);
  if (devTargetProj && ['in_production', 'review_round', 'delivered'].includes(status)) {
    const effectivePayment = paymentStatus || devTargetProj.paymentStatus;
    if (effectivePayment !== 'paid') {
      return NextResponse.json(
        { error: 'Cannot start production: Project has not been paid. Payment confirmation required before entering production.' },
        { status: 400 }
      );
    }
  }

  const updated = updateProjectStatus(id, status as any, paymentStatus);
  if (!updated) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, project: updated });
}
