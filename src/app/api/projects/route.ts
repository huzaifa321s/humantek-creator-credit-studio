import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { orderRequestSchema, patchProjectSchema, firstIssue } from '@/lib/validation';
import { createNotification, notifyAdmins } from '@/lib/notifications';
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
import { serializeClientProject, serializeAdminProject } from '@/lib/serializers/project';
import { PACKAGES, SERVICES } from '@/lib/catalog';
import { attachProjectReferences, signReferenceFiles, verifyReferenceFiles } from '@/lib/references';
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  compareIsoTimestamps,
  sanitizeSearchQuery,
  PAGINATION_LIMITS,
} from '@/lib/pagination';


export async function GET(req: NextRequest) {
  const tStart = performance.now();
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const authDurationMs = Math.round(performance.now() - tStart);

  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get('id');

  // Client reads use standard client with RLS; admins use adminClient
  const dbClient = user.isAdmin ? createAdminClient() : await createClient();

  // 1. Single Project Detail Mode (loads full project with selections & additions)
  if (singleId) {
    if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
      try {
        let query = dbClient
          .from('projects')
          .select('*, project_items(*), project_additions(*)')
          .eq('id', singleId);

        // Strict user_id ownership check (defense-in-depth on top of RLS)
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
        if (Array.isArray(data.uploaded_files) && data.uploaded_files.length > 0) {
          data.uploaded_files = await signReferenceFiles(createAdminClient(), data.uploaded_files, 900);
        }
        const serialized = user.isAdmin
          ? serializeAdminProject(data)
          : serializeClientProject(data);
        return NextResponse.json({ project: serialized });
      } catch (err) {
        console.error('Single project query exception in GET /api/projects:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }
    const p = getProjectById(singleId);
    if (!p) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!user.isAdmin && p.userId && p.userId !== user.id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const serialized = user.isAdmin ? serializeAdminProject(p) : serializeClientProject(p);
    return NextResponse.json({ project: serialized });
  }

  // 2. Paginated List Mode
  const limitParam = searchParams.get('limit');
  const cursorParam = searchParams.get('cursor');
  const statusParam = searchParams.get('status') || 'all';
  const paymentStatusParam = searchParams.get('paymentStatus') || 'all';
  const rawSearch = searchParams.get('search')?.trim() || '';
  const cleanSearch = sanitizeSearchQuery(rawSearch);
  const summaryParam = searchParams.get('summary') !== 'false';
  const pageParam = searchParams.get('page');

  const defaultLimit = user.isAdmin ? PAGINATION_LIMITS.ADMIN_DEFAULT : PAGINATION_LIMITS.CLIENT_DEFAULT;
  const maxLimit = user.isAdmin ? PAGINATION_LIMITS.ADMIN_MAX : PAGINATION_LIMITS.CLIENT_MAX;
  const limit = clampLimit(limitParam, defaultLimit, maxLimit);
  const cursor = decodeCursor(cursorParam);

  // A. Production / Real Supabase Path
  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    try {
      const tDb = performance.now();

      // Aggregate tab counts
      let statusQuery = dbClient.from('projects').select('status');
      if (!user.isAdmin) {
        statusQuery = statusQuery.eq('user_id', user.id);
      }

      // Build data query (always include project_items and additions so cards display selected services accurately)
      let dataQuery = summaryParam
        ? dbClient
          .from('projects')
          .select(
            'id, user_id, project_code, package_id, package_name, package_price_usd, package_credits, total_credits, status, payment_status, payment_method, funding_source, applied_wallet_credits, client_name, channel_name, email, platform, style, colors, instructions, uploaded_files, last_message_at, last_message_preview, created_at, project_items(*), project_additions(*)',
            { count: 'exact' }
          )
        : dbClient
          .from('projects')
          .select('*, project_items(*), project_additions(*)', { count: 'exact' });

      // Tenant isolation: clients only see their own projects (enforced both in query & RLS)
      if (!user.isAdmin) {
        dataQuery = dataQuery.eq('user_id', user.id);
      }

      // Status filter
      if (statusParam && statusParam !== 'all') {
        if (statusParam === 'active') {
          dataQuery = dataQuery.not('status', 'in', '("delivered","declined","cancelled")');
        } else if (statusParam === 'delivered') {
          dataQuery = dataQuery.eq('status', 'delivered');
        } else {
          dataQuery = dataQuery.eq('status', statusParam);
        }
      }

      // Payment status filter (e.g. for admin)
      if (paymentStatusParam && paymentStatusParam !== 'all') {
        dataQuery = dataQuery.eq('payment_status', paymentStatusParam);
      }

      // Server-side search filter with strict PostgREST injection sanitization
      if (cleanSearch) {
        const s = `%${cleanSearch}%`;
        dataQuery = dataQuery.or(`project_code.ilike.${s},client_name.ilike.${s},channel_name.ilike.${s},package_name.ilike.${s},email.ilike.${s}`);
      }

      // Keyset cursor or offset page
      if (cursor) {
        dataQuery = dataQuery.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
        );
      } else if (pageParam && user.isAdmin) {
        const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
        const offset = (pageNum - 1) * limit;
        dataQuery = dataQuery.range(offset, offset + limit - 1);
      }

      // Deterministic keyset ordering
      dataQuery = dataQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (!pageParam || !user.isAdmin) {
        dataQuery = dataQuery.limit(limit + 1);
      }

      // Execute counts and data query concurrently in a single network round-trip
      const [statusRes, dataRes] = await Promise.all([
        statusQuery,
        dataQuery,
      ]);

      const dbDurationMs = Math.round(performance.now() - tDb);

      if (dataRes.error) {
        console.error('Error retrieving projects from database:', dataRes.error);
        return NextResponse.json({ error: 'Failed to retrieve projects' }, { status: 500 });
      }

      let allCount = 0;
      let activeCount = 0;
      let pendingReviewCount = 0;
      let paymentConfirmedCount = 0;
      let inProductionCount = 0;
      let reviewRoundCount = 0;
      let deliveredCount = 0;
      let cancelledCount = 0;
      let declinedCount = 0;

      (statusRes.data || []).forEach((row) => {
        allCount++;
        if (row.status === 'delivered') {
          deliveredCount++;
        } else if (row.status === 'cancelled') {
          cancelledCount++;
        } else if (row.status === 'declined') {
          declinedCount++;
        } else {
          activeCount++;
          if (row.status === 'pending_review') pendingReviewCount++;
          else if (row.status === 'payment_confirmed') paymentConfirmedCount++;
          else if (row.status === 'in_production') inProductionCount++;
          else if (row.status === 'review_round') reviewRoundCount++;
        }
      });

      const rows: any[] = (dataRes.data as any[]) || [];
      let items = rows;
      let hasMore = false;
      let nextCursor: string | null = null;

      if (!pageParam || !user.isAdmin) {
        hasMore = rows.length > limit;
        items = hasMore ? rows.slice(0, limit) : rows;
        const lastRow: any = items[items.length - 1];
        nextCursor =
          hasMore && lastRow
            ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id })
            : null;
      } else {
        const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
        hasMore = pageNum * limit < (dataRes.count ?? 0);
      }

      const projects = items.map(formatDbProject);
      const res = NextResponse.json({
        projects,
        totalCount: dataRes.count ?? projects.length,
        counts: {
          all: allCount,
          active: activeCount,
          pending_review: pendingReviewCount,
          payment_confirmed: paymentConfirmedCount,
          in_production: inProductionCount,
          review_round: reviewRoundCount,
          delivered: deliveredCount,
          cancelled: cancelledCount,
          declined: declinedCount,
        },
        hasMore,
        nextCursor,
        limit,
      });

      res.headers.set(
        'Server-Timing',
        `auth;dur=${authDurationMs}, db;dur=${dbDurationMs}, total;dur=${Math.round(performance.now() - tStart)}`
      );
      return res;
    } catch (err) {
      console.error('Database query exception in GET /api/projects:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // B. Dev Mock Fallback (strictly disabled in production)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }
  let all = getProjects();
  if (!user.isAdmin) {
    all = all.filter((p) => (p.userId ? p.userId === user.id : false));
  }

  let allCount = 0;
  let activeCount = 0;
  let pendingReviewCount = 0;
  let paymentConfirmedCount = 0;
  let inProductionCount = 0;
  let reviewRoundCount = 0;
  let deliveredCount = 0;
  let cancelledCount = 0;
  let declinedCount = 0;

  all.forEach((p) => {
    allCount++;
    if (p.status === 'delivered') deliveredCount++;
    else if (p.status === 'cancelled') cancelledCount++;
    else if (p.status === 'declined') declinedCount++;
    else {
      activeCount++;
      if (p.status === 'pending_review') pendingReviewCount++;
      else if (p.status === 'payment_confirmed') paymentConfirmedCount++;
      else if (p.status === 'in_production') inProductionCount++;
      else if (p.status === 'review_round') reviewRoundCount++;
    }
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

  if (cleanSearch) {
    const q = cleanSearch.toLowerCase();
    filtered = filtered.filter((p) =>
      p.projectCode.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      (p.channelName && p.channelName.toLowerCase().includes(q)) ||
      p.packageName.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  }

  filtered.sort((a, b) => {
    const cmp = compareIsoTimestamps(b.createdAt, a.createdAt);
    if (cmp !== 0) return cmp;
    return (b.id || '').localeCompare(a.id || '');
  });

  const totalCount = filtered.length;
  let sliced = filtered;

  if (cursor) {
    const idx = filtered.findIndex((p) => {
      const cmp = compareIsoTimestamps(p.createdAt, cursor.createdAt);
      if (cmp < 0) return true;
      if (cmp === 0) return (p.id || '') < cursor.id;
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

  const res = NextResponse.json({
    projects,
    totalCount,
    counts: {
      all: allCount,
      active: activeCount,
      pending_review: pendingReviewCount,
      payment_confirmed: paymentConfirmedCount,
      in_production: inProductionCount,
      review_round: reviewRoundCount,
      delivered: deliveredCount,
      cancelled: cancelledCount,
      declined: declinedCount,
    },
    hasMore,
    nextCursor,
    limit,
  });

  res.headers.set(
    'Server-Timing',
    `auth;dur=${authDurationMs}, db;dur=0, total;dur=${Math.round(performance.now() - tStart)}`
  );
  return res;
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

  // Administrators cannot create client projects for themselves (strictly blocked)
  if (user.role === 'admin') {
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

      // Authoritative reference verification: Attach pending uploads from project_uploads
      // If a claimed file is missing, expired, or belongs to another user, fail submission clearly.
      let verifiedReferences: Awaited<ReturnType<typeof verifyReferenceFiles>> = [];
      if (Array.isArray(parsed.data.uploadedFiles) && parsed.data.uploadedFiles.length > 0) {
        try {
          verifiedReferences = await attachProjectReferences(
            adminClient,
            user.id,
            parsed.data.projectId,
            parsed.data.uploadedFiles
          );
        } catch (refErr) {
          const msg = refErr instanceof Error ? refErr.message : 'Reference verification failed';
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      }
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

        const itemsToInsert = (parsed.data.selections || []).map((sel: any) => {
          const serviceDef = validServices.get(sel.id) || SERVICES.find((s) => s.id === sel.id);
          const serviceName = serviceDef ? serviceDef.name : (sel.name || sel.id);
          const unitCredits = serviceDef ? (serviceDef.quoteOnly ? 0 : serviceDef.prices[sel.level] ?? 0) : 0;
          const totalCredits = unitCredits * sel.quantity;
          return {
            project_id: parsed.data.projectId,
            service_id: sel.id,
            service_name: serviceName,
            tier_level: sel.level,
            quantity: sel.quantity,
            unit_credits: unitCredits,
            total_credits: totalCredits,
          };
        });

        const totalCreditsRequired = itemsToInsert.reduce(
          (sum: number, item) => sum + item.total_credits,
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
            package_credits: pkg.credits || 0,
            total_credits: totalCreditsRequired,
            applied_wallet_credits: 0,
            client_name: ownerName,
            channel_name: parsed.data.channelName || '',
            email: ownerEmail,
            platform: parsed.data.platform || '',
            style: parsed.data.style || '',
            colors: parsed.data.colors || '',
            instructions: parsed.data.instructions || '',
            uploaded_files: verifiedReferences,
            reference_links: parsed.data.referenceLinks || [],
            idempotency_key: parsed.data.projectId,
          })
          .select('*, project_items(*), project_additions(*)')
          .single();

        if (insertErr) {
          console.error('Failed to insert unpaid project:', insertErr);
          return NextResponse.json({ error: 'Failed to submit project for review' }, { status: 500 });
        }

        // Insert project items
        if (itemsToInsert.length > 0) {
          const { error: itemsErr } = await adminClient.from('project_items').insert(itemsToInsert);
          if (itemsErr) {
            console.error('Failed to insert project items:', itemsErr);
          }
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

        // Major action notification: Brief submitted
        void createNotification({
          userId: user.id,
          type: 'project_status',
          title: `Project submitted · ${projectCode}`,
          message: `We received your ${pkg.name} brief (${totalCreditsRequired} CR scope) and will review it shortly.`,
          link: `/projects/${parsed.data.projectId}`,
          actionLabel: 'View Project',
          actionId: parsed.data.projectId,
          entityType: 'project',
          entityId: parsed.data.projectId,
        });

        void notifyAdmins({
          type: 'project_status',
          title: `New project request · ${projectCode}`,
          message: `${ownerName} submitted a ${pkg.name} brief (${totalCreditsRequired} CR) for review.`,
          link: `/management?tab=projects&id=${parsed.data.projectId}`,
          actionLabel: 'Review Brief',
          actionId: parsed.data.projectId,
          entityType: 'project',
          entityId: parsed.data.projectId,
        });

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
        p_uploaded_files: verifiedReferences,
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

      // Major action notification: Project started with credits (only on initial creation, not replay)
      if (!rpcRes?.replayed) {
        const spentCredits = project?.usedCredits || Number(projRow?.total_credits) || 0;
        void createNotification({
          userId: user.id,
          type: 'project_status',
          title: `Project started · ${projectCode}`,
          message: `Your project (${spentCredits} CR) was funded with Studio Wallet credits and is now queued.`,
          link: `/projects/${parsed.data.projectId}`,
          actionLabel: 'View Project',
          actionId: parsed.data.projectId,
          entityType: 'project',
          entityId: parsed.data.projectId,
        });

        void notifyAdmins({
          type: 'project_status',
          title: `New credit project · ${projectCode}`,
          message: `${ownerName} started a new project (${spentCredits} CR) with wallet credits.`,
          link: `/management?tab=projects&id=${parsed.data.projectId}`,
          actionLabel: 'View Project',
          actionId: parsed.data.projectId,
          entityType: 'project',
          entityId: parsed.data.projectId,
        });
      }

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

  // 2. Dev Mock Fallback (strictly disabled in production)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }
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

      if (updatedProj) {
        const pCode = updatedProj.project_code || id;
        const refundedCr = Number(updatedProj.total_credits) || 0;
        if (user.isAdmin && updatedProj.user_id !== user.id) {
          void createNotification({
            userId: updatedProj.user_id,
            type: 'project_status',
            title: `Project cancelled · ${pCode}`,
            message:
              updatedProj.payment_status === 'paid' && refundedCr > 0
                ? `Your project (${pCode}) was cancelled and +${refundedCr} CR were refunded to your Studio Wallet.`
                : `Your project (${pCode}) was cancelled.`,
            link: `/projects/${id}`,
            actionLabel: 'View Details',
            actionId: id,
            entityType: 'project',
            entityId: id,
          });
        } else if (!user.isAdmin) {
          void notifyAdmins({
            type: 'project_status',
            title: `Project cancelled · ${pCode}`,
            message: `${user.email} cancelled project ${pCode}.`,
            link: `/management?tab=projects&id=${id}`,
            actionLabel: 'View Project',
            actionId: id,
            entityType: 'project',
            entityId: id,
          });
        }
      }

      return NextResponse.json({ success: true, project: formatDbProject(updatedProj) });
    }

    // Other status updates strictly require admin access
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Load current project before updating so paymentStatus transitions can be applied first
    // (allowing an admin to confirm payment and transition to in_production in a single save)
    const { data: currentProj } = await adminClient
      .from('projects')
      .select('id, user_id, project_code, package_id, package_name, package_credits, total_credits, status, payment_status, funding_source')
      .eq('id', id)
      .maybeSingle();

    if (!currentProj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let notifiedPaymentConfirmed = false;

    if (paymentStatus && paymentStatus !== currentProj.payment_status) {
      const catalogPkg = PACKAGES.find((p) => p.id === currentProj.package_id);
      const effectivePkgCredits =
        Number(currentProj.package_credits) || catalogPkg?.credits || 0;

      await adminClient
        .from('projects')
        .update({
          payment_status: paymentStatus,
          ...(effectivePkgCredits > 0 && !currentProj.package_credits
            ? { package_credits: effectivePkgCredits }
            : {}),
        })
        .eq('id', id);

      // Post audited credit_ledger entries on payment confirmation / refund
      if (currentProj.user_id && currentProj.project_code) {
        if (paymentStatus === 'paid') {
          // 1. Grant package credits if this is a package project and not already granted
          if (effectivePkgCredits > 0 && currentProj.package_id !== 'studio-wallet') {
            const { error: grantErr } = await adminClient.rpc('ledger_post', {
              p_user: currentProj.user_id,
              p_bucket: 'purchased',
              p_delta: effectivePkgCredits,
              p_type: 'package_purchase',
              p_ref: currentProj.project_code,
              p_key: `project:${currentProj.id}:grant`,
              p_desc: `Package purchase confirmed for ${currentProj.package_name || 'Studio Package'} (${currentProj.project_code})`,
              p_reverses_id: null,
            });
            if (grantErr) {
              console.warn('Ledger grant warning on payment confirmation:', grantErr.message);
            }
          }

          // 2. Deduct project service scope credits if not already deducted
          const totalUsed = Number(currentProj.total_credits) || 0;
          if (totalUsed > 0) {
            const { error: spendErr } = await adminClient.rpc('spend_credits', {
              p_user: currentProj.user_id,
              p_amount: totalUsed,
              p_ref: currentProj.project_code,
              p_key: `${currentProj.id}:spend`,
              p_desc: `Credits spent for order ${currentProj.project_code}`,
            });
            if (spendErr) {
              console.warn('Ledger spend warning on payment confirmation:', spendErr.message);
            }
          }

          // 3. Notify client of payment confirmation and any surplus package credits added to wallet
          const isPackageFunding = currentProj.package_id !== 'studio-wallet' && effectivePkgCredits > 0;
          const surplusCredits = isPackageFunding ? Math.max(0, effectivePkgCredits - totalUsed) : 0;
          const pkgLabel = currentProj.package_name || catalogPkg?.name || 'Studio Package';

          notifiedPaymentConfirmed = true;
          void createNotification({
            userId: currentProj.user_id,
            type: 'payment_confirmed',
            title:
              surplusCredits > 0
                ? `Payment confirmed · +${surplusCredits} CR added`
                : `Payment confirmed · ${currentProj.project_code}`,
            message:
              surplusCredits > 0
                ? `Payment confirmed for ${currentProj.project_code} (${pkgLabel}). ${totalUsed} CR allocated to your project and +${surplusCredits} CR added to your Studio Wallet.`
                : `Payment confirmed for ${currentProj.project_code} (${pkgLabel} · ${totalUsed} CR). Your project is funded and ready for production.`,
            link: `/projects/${id}`,
            actionLabel: 'View Project',
            actionId: id,
            entityType: 'project',
            entityId: id,
          });
        } else if (paymentStatus === 'refunded') {
          // Reverse any un-reversed service_deduction or package_purchase entries for this project
          const { data: ledgerRows } = await adminClient
            .from('credit_ledger')
            .select('id, bucket, delta, type, idempotency_key')
            .eq('user_id', currentProj.user_id)
            .eq('reference_id', currentProj.project_code);

          const { data: existingReversals } = await adminClient
            .from('credit_ledger')
            .select('reverses_id')
            .eq('user_id', currentProj.user_id)
            .not('reverses_id', 'is', null);

          const reversedSet = new Set(
            (existingReversals || []).map((r: any) => Number(r.reverses_id))
          );

          for (const row of ledgerRows || []) {
            if (reversedSet.has(Number(row.id))) continue;
            if (row.type === 'service_deduction') {
              await adminClient.rpc('ledger_post', {
                p_user: currentProj.user_id,
                p_bucket: row.bucket,
                p_delta: -Number(row.delta),
                p_type: 'refund_wallet',
                p_ref: currentProj.project_code,
                p_key: `refund:${row.idempotency_key}`,
                p_desc: `Refund for project ${currentProj.project_code}`,
                p_reverses_id: row.id,
              });
            } else if (row.type === 'package_purchase') {
              await adminClient.rpc('ledger_post', {
                p_user: currentProj.user_id,
                p_bucket: 'purchased',
                p_delta: -Number(row.delta),
                p_type: 'refund_cash',
                p_ref: currentProj.project_code,
                p_key: `refund:${row.idempotency_key}`,
                p_desc: `Cash refund reversal for ${currentProj.project_code}`,
                p_reverses_id: row.id,
              });
            }
          }

          // Notify client that payment was refunded and credit balance updated
          void createNotification({
            userId: currentProj.user_id,
            type: 'payment_confirmed',
            title: `Payment refunded · ${currentProj.project_code}`,
            message: `Your payment for project ${currentProj.project_code} has been refunded and your studio credit balance was updated.`,
            link: `/projects/${id}`,
            actionLabel: 'View Project',
            actionId: id,
            entityType: 'project',
            entityId: id,
          });
        }
      }
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

    const { data: updatedProj } = await adminClient
      .from('projects')
      .select('*, project_items(*), project_additions(*)')
      .eq('id', id)
      .single();

    // Major action notifications on status transitions (only when status actually changed)
    if (updatedProj && updatedProj.user_id && status !== currentProj.status) {
      const pCode = updatedProj.project_code || id;
      if (status === 'payment_confirmed' && !notifiedPaymentConfirmed) {
        void createNotification({
          userId: updatedProj.user_id,
          type: 'payment_confirmed',
          title: `Payment confirmed · ${pCode}`,
          message: `Your payment for ${pCode} has been confirmed and your project is ready for production.`,
          link: `/projects/${id}`,
          actionLabel: 'View Project',
          actionId: id,
          entityType: 'project',
          entityId: id,
        });
      } else if (status === 'in_production') {
        void createNotification({
          userId: updatedProj.user_id,
          type: 'project_status',
          title: `Production started · ${pCode}`,
          message: `We started working on your ${updatedProj.package_name || 'Studio'} project (${pCode}).`,
          link: `/projects/${id}`,
          actionLabel: 'View Project',
          actionId: id,
          entityType: 'project',
          entityId: id,
        });
      } else if (status === 'review_round') {
        void createNotification({
          userId: updatedProj.user_id,
          type: 'project_status',
          title: `Preview ready · ${pCode}`,
          message: `Your design preview for ${pCode} is ready to review.`,
          link: `/projects/${id}`,
          actionLabel: 'Review Now',
          actionId: id,
          entityType: 'project',
          entityId: id,
        });
      } else if (status === 'delivered') {
        void createNotification({
          userId: updatedProj.user_id,
          type: 'project_status',
          title: `Project completed! 🎉 · ${pCode}`,
          message: `Your project (${pCode}) has been marked as completed.`,
          link: `/projects/${id}`,
          actionLabel: 'View Project',
          actionId: id,
          entityType: 'project',
          entityId: id,
        });
      } else if (status === 'declined') {
        void createNotification({
          userId: updatedProj.user_id,
          type: 'project_status',
          title: `Brief declined · ${pCode}`,
          message: `Your project brief (${pCode}) could not be accepted. Check project details.`,
          link: `/projects/${id}`,
          actionLabel: 'View Details',
          actionId: id,
          entityType: 'project',
          entityId: id,
        });
      }
    }

    return NextResponse.json({ success: true, project: formatDbProject(updatedProj) });
  }

  // 2. Dev Mock Fallback (strictly disabled in production)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }
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
