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




import { clampLimit, decodeCursor, encodeCursor, PAGINATION_LIMITS } from '@/lib/pagination';

/**
 * Admins see every project; signed-in creators only see their own.
 * Supports:
 * - Single project retrieval: GET /api/projects?id=<projectId> (full details including selections & additions)
 * - Keyset cursor pagination: GET /api/projects?cursor=<base64url>&limit=20
 * - Server-side search & filtering: GET /api/projects?search=HT-8531&status=active
 * - Lightweight summary-only responses: summary=true (default for lists)
 */
export async function GET(req: NextRequest) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get('id');

  // 1. Single Project Detail Mode (loads full project with selections & additions)
  if (singleId) {
    if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
      try {
        const adminClient = createAdminClient();
        let query = adminClient
          .from('projects')
          .select('*, project_items(*), project_additions(*)')
          .eq('id', singleId);

        if (!user.isAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
          console.error('Error fetching project detail:', error);
          return NextResponse.json({ error: 'Failed to retrieve project' }, { status: 500 });
        }
        if (!data) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        return NextResponse.json({ project: formatDbProject(data) });
      } catch (err) {
        console.error('Single project query exception in GET /api/projects:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }

    const p = getProjectById(singleId);
    if (!p) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!user.isAdmin && p.userId && p.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ project: p });
  }

  // 2. Paginated List Mode
  const limitParam = searchParams.get('limit');
  const cursorParam = searchParams.get('cursor');
  const statusParam = searchParams.get('status') || 'all';
  const paymentStatusParam = searchParams.get('paymentStatus') || 'all';
  const searchParam = searchParams.get('search')?.trim() || '';
  const summaryParam = searchParams.get('summary') !== 'false';
  const pageParam = searchParams.get('page');

  const defaultLimit = user.isAdmin ? PAGINATION_LIMITS.ADMIN_DEFAULT : PAGINATION_LIMITS.CLIENT_DEFAULT;
  const maxLimit = user.isAdmin ? PAGINATION_LIMITS.ADMIN_MAX : PAGINATION_LIMITS.CLIENT_MAX;
  const limit = clampLimit(limitParam, defaultLimit, maxLimit);
  const cursor = decodeCursor(cursorParam);

  // A. Production / Real Supabase Path
  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    try {
      const adminClient = createAdminClient();

      // Aggregate tab counts: all, active, delivered
      let statusQuery = adminClient.from('projects').select('status');
      if (!user.isAdmin) {
        statusQuery = statusQuery.eq('user_id', user.id);
      }
      const { data: statusRows } = await statusQuery;

      let allCount = 0;
      let activeCount = 0;
      let deliveredCount = 0;
      (statusRows || []).forEach((row) => {
        allCount++;
        if (row.status === 'delivered') deliveredCount++;
        else if (row.status !== 'declined' && row.status !== 'cancelled') activeCount++;
      });

      // Build data query
      let query = summaryParam
        ? adminClient
            .from('projects')
            .select(
              'id, user_id, project_code, package_id, package_name, package_price_usd, package_credits, total_credits, status, payment_status, payment_method, funding_source, applied_wallet_credits, client_name, channel_name, email, platform, style, colors, instructions, uploaded_files, last_message_at, last_message_preview, created_at',
              { count: 'exact' }
            )
        : adminClient
            .from('projects')
            .select('*, project_items(*), project_additions(*)', { count: 'exact' });

      // Tenant isolation: clients only see their own projects
      if (!user.isAdmin) {
        query = query.eq('user_id', user.id);
      }

      // Status filter
      if (statusParam && statusParam !== 'all') {
        if (statusParam === 'active') {
          query = query.not('status', 'in', '("delivered","declined","cancelled")');
        } else if (statusParam === 'delivered') {
          query = query.eq('status', 'delivered');
        } else {
          query = query.eq('status', statusParam);
        }
      }

      // Payment status filter (e.g. for admin)
      if (paymentStatusParam && paymentStatusParam !== 'all') {
        query = query.eq('payment_status', paymentStatusParam);
      }

      // Server-side search filter
      if (searchParam) {
        const sanitized = searchParam.replace(/[,()]/g, '');
        const s = `%${sanitized}%`;
        query = query.or(`project_code.ilike.${s},client_name.ilike.${s},channel_name.ilike.${s},package_name.ilike.${s}`);
      }

      // Keyset cursor or offset page
      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
        );
      } else if (pageParam && user.isAdmin) {
        const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
        const offset = (pageNum - 1) * limit;
        query = query.range(offset, offset + limit - 1);
      }

      // Deterministic keyset ordering
      query = query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (!pageParam || !user.isAdmin) {
        query = query.limit(limit + 1);
      }

      const { data, error, count } = await query;
      if (error) {
        console.error('Error retrieving projects from database:', error);
        return NextResponse.json({ error: 'Failed to retrieve projects' }, { status: 500 });
      }

      const rows: any[] = (data as any[]) || [];
      let items = rows;
      let hasMore = false;
      let nextCursor: string | null = null;

      if (!pageParam || !user.isAdmin) {
        hasMore = rows.length > limit;
        items = hasMore ? rows.slice(0, limit) : rows;
        const lastRow = items[items.length - 1];
        nextCursor =
          hasMore && lastRow
            ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id })
            : null;
      } else {
        const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
        hasMore = pageNum * limit < (count ?? 0);
      }

      const projects = items.map(formatDbProject);
      return NextResponse.json({
        projects,
        totalCount: count ?? projects.length,
        counts: {
          all: allCount,
          active: activeCount,
          delivered: deliveredCount,
        },
        hasMore,
        nextCursor,
        limit,
      });
    } catch (err) {
      console.error('Database query exception in GET /api/projects:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // B. Dev Mock Fallback
  let all = getProjects();
  if (!user.isAdmin) {
    all = all.filter((p) => (p.userId ? p.userId === user.id : false));
  }

  let allCount = 0;
  let activeCount = 0;
  let deliveredCount = 0;
  all.forEach((p) => {
    allCount++;
    if (p.status === 'delivered') deliveredCount++;
    else if (p.status !== 'declined' && p.status !== 'cancelled') activeCount++;
  });

  let filtered = all;
  if (statusParam && statusParam !== 'all') {
    if (statusParam === 'active') {
      filtered = filtered.filter((p) => p.status !== 'delivered' && p.status !== 'declined' && p.status !== 'cancelled');
    } else if (statusParam === 'delivered') {
      filtered = filtered.filter((p) => p.status === 'delivered');
    } else {
      filtered = filtered.filter((p) => p.status === statusParam);
    }
  }

  if (paymentStatusParam && paymentStatusParam !== 'all') {
    filtered = filtered.filter((p) => p.paymentStatus === paymentStatusParam);
  }

  if (searchParam) {
    const q = searchParam.toLowerCase();
    filtered = filtered.filter((p) =>
      p.projectCode.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      (p.channelName && p.channelName.toLowerCase().includes(q)) ||
      p.packageName.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  }

  filtered.sort((a, b) => {
    const tA = new Date(a.createdAt).getTime();
    const tB = new Date(b.createdAt).getTime();
    if (tB !== tA) return tB - tA;
    return (b.id || '').localeCompare(a.id || '');
  });

  const totalCount = filtered.length;
  let sliced = filtered;

  if (cursor) {
    const idx = filtered.findIndex((p) => {
      const tP = new Date(p.createdAt).getTime();
      const tC = new Date(cursor.createdAt).getTime();
      if (tP < tC) return true;
      if (tP === tC) return (p.id || '') < cursor.id;
      return false;
    });
    sliced = idx >= 0 ? filtered.slice(idx) : [];
  } else if (pageParam && user.isAdmin) {
    const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
    const offset = (pageNum - 1) * limit;
    sliced = filtered.slice(offset, offset + limit);
  }

  let hasMore = false;
  let items = sliced;
  let nextCursor: string | null = null;

  if (!pageParam || !user.isAdmin) {
    hasMore = sliced.length > limit;
    items = hasMore ? sliced.slice(0, limit) : sliced;
    const last = items[items.length - 1];
    nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
  } else {
    const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
    hasMore = pageNum * limit < totalCount;
  }

  const projects = summaryParam
    ? items.map((p) => ({ ...p, selections: [], additions: [] }))
    : items;

  return NextResponse.json({
    projects,
    totalCount,
    counts: {
      all: allCount,
      active: activeCount,
      delivered: deliveredCount,
    },
    hasMore,
    nextCursor,
    limit,
  });
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
