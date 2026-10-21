import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { capturePayPalOrder } from '@/lib/paypal';
import { createNotification, notifyAdmins } from '@/lib/notifications';
import { adjustUserBalance, getUserBalance } from '@/lib/store';
import { attachProjectReferences, verifyReferenceFiles } from '@/lib/references';

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

  const { orderId, internalOrderId, projectPayload } = (body as Record<string, unknown>) || {};
  const queryOrderId = (typeof orderId === 'string' && orderId.trim())
    ? orderId.trim()
    : (typeof internalOrderId === 'string' ? internalOrderId.trim() : '');

  if (!queryOrderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  // 1. Production / Real Supabase Path
  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    const adminClient = createAdminClient();

    // Query order from database
    let query = adminClient.from('orders').select('*');
    if (queryOrderId.includes('-') && queryOrderId.length === 36) {
      // UUID check
      query = query.or(`id.eq.${queryOrderId},provider_order_id.eq.${queryOrderId}`);
    } else {
      query = query.eq('provider_order_id', queryOrderId);
    }

    const { data: order, error: orderErr } = await query.maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Strict Cross-Tenant Authorization Check
    if (order.user_id !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to capture this order' }, { status: 403 });
    }

    const createOrFetchProjectForOrder = async (rawPayload: Record<string, any>) => {
      const pkgCodeMap: Record<string, string> = {
        'creator-forge': 'FORGE',
        'studio-momentum': 'MOMENTUM',
        'signature-collective': 'SIGNATURE',
        'studio-wallet': 'WALLET',
      };
      const pkgCode = pkgCodeMap[rawPayload.packageId] || 'STUDIO';
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const projectCode = `HT-${randomDigits}-${pkgCode}`;

      let ownerName = 'Creator';
      const { data: profile } = await adminClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.full_name?.trim()) {
        ownerName = profile.full_name.trim();
      } else if (user.email) {
        ownerName = user.email.split('@')[0];
      }

      const verifiedUploadedFiles = await attachProjectReferences(
        adminClient,
        user.id,
        String(rawPayload.projectId || ''),
        Array.isArray(rawPayload.uploadedFiles) ? rawPayload.uploadedFiles : []
      ).catch((refErr) => {
        console.error('Reference attachment failed after capture:', refErr);
        return [];
      });

      const { data: projRpcRes, error: rpcErr } = await adminClient.rpc(
        'create_project_and_spend_credits',
        {
          p_project_id: rawPayload.projectId,
          p_project_code: projectCode,
          p_user_id: user.id,
          p_package_id: rawPayload.packageId || order.package_id,
          p_funding_source: 'wallet',
          p_client_name: ownerName,
          p_channel_name: rawPayload.channelName || '',
          p_email: user.email,
          p_platform: rawPayload.platform || '',
          p_style: rawPayload.style || '',
          p_colors: rawPayload.colors || '',
          p_instructions: rawPayload.instructions || '',
          p_uploaded_files: verifiedUploadedFiles,
          p_selections: rawPayload.selections || [],
          p_additions: rawPayload.additions || [],
          p_idempotency_key: rawPayload.projectId,
        }
      );

      if (rpcErr) {
        console.error(
          'Project creation RPC error after capture (credits remain safely in wallet):',
          rpcErr
        );
      } else if (rawPayload.projectId) {
        const expectedUsd = Number(order.expected_amount_cents) > 0 ? Number(order.expected_amount_cents) / 100 : 0;
        const pkgCredits = Number(order.credits_to_grant) || 0;
        await adminClient
          .from('projects')
          .update({
            payment_method: 'paypal',
            funding_source: rawPayload.fundingSource === 'hybrid' ? 'hybrid' : 'package',
            ...(expectedUsd > 0 ? { package_price_usd: expectedUsd } : {}),
            ...(pkgCredits > 0 ? { package_credits: pkgCredits } : {}),
            ...(order.provider_capture_id || order.provider_order_id
              ? {
                  instructions: [
                    `[PAYMENT RECEIVED via PayPal] | PayPal Order ID: ${order.provider_order_id || order.id}${order.provider_capture_id ? ` | Capture ID: ${order.provider_capture_id}` : ''}`,
                    rawPayload.instructions || '',
                  ]
                    .filter(Boolean)
                    .join('\n\n'),
                }
              : {}),
          })
          .eq('id', rawPayload.projectId);
      }

      const { data: projRow } = await adminClient
        .from('projects')
        .select('*, project_items(*), project_additions(*)')
        .eq('id', rawPayload.projectId)
        .maybeSingle();

      const formattedProject = projRow
        ? {
            id: projRow.id,
            projectCode: projRow.project_code,
            packageId: projRow.package_id || 'studio-wallet',
            packageName: projRow.package_name || '',
            packagePrice: Number(projRow.package_price_usd) || 0,
            packageCredits: projRow.package_credits || 0,
            usedCredits: projRow.total_credits || 0,
            remainingCredits: 0,
            status: projRow.status,
            paymentStatus: projRow.payment_status,
            paymentMethod: projRow.payment_method,
            fundingSource: projRow.funding_source,
            appliedWalletCredits: projRow.applied_wallet_credits || 0,
            clientName: projRow.client_name,
            channelName: projRow.channel_name || '',
            email: projRow.email,
            platform: projRow.platform || '',
            style: projRow.style || '',
            colors: projRow.colors || '',
            instructions: projRow.instructions || '',
            uploadedFiles: Array.isArray(projRow.uploaded_files) ? projRow.uploaded_files : [],
            lastMessageAt: projRow.last_message_at || null,
            lastMessagePreview: projRow.last_message_preview || null,
            additions: (projRow.project_additions || []).map((a: any) => a.name),
            selections: (projRow.project_items || []).map((i: any) => ({
              id: i.service_id,
              name: i.service_name,
              level: i.tier_level,
              quantity: i.quantity,
              credits: i.total_credits,
            })),
            createdAt: projRow.created_at,
          }
        : null;

      return {
        project: formattedProject,
        rpcBalance: (projRpcRes as any)?.new_balance ?? (projRpcRes as any)?.new_wallet_balance,
      };
    };

    // Idempotency: if already fulfilled (e.g. via webhook), ensure project is created if projectPayload was supplied
    if (order.status === 'fulfilled') {
      let dbProject = null;
      let rpcBalance: number | undefined;
      if (projectPayload && typeof projectPayload === 'object') {
        const raw = projectPayload as Record<string, any>;
        if (raw.projectId) {
          const res = await createOrFetchProjectForOrder(raw);
          dbProject = res.project;
          rpcBalance = res.rpcBalance;
        }
      }

      const { data: wallet } = await adminClient
        .from('wallets')
        .select('balance_credits')
        .eq('user_id', order.user_id)
        .single();

      return NextResponse.json({
        success: true,
        status: 'fulfilled',
        creditsGranted: order.credits_to_grant,
        newWalletBalance: wallet?.balance_credits ?? rpcBalance,
        project: dbProject,
        message: 'Order was already fulfilled.',
      });
    }

    const expectedUSD = order.expected_amount_cents / 100;
    const captureIdempKey = `cap-${order.id}`;

    try {
      const capture = await capturePayPalOrder(order.provider_order_id || queryOrderId, expectedUSD, captureIdempKey);

      if (capture.status === 'COMPLETED') {
        const capturedAmountCents = capture.amountUSD !== null
          ? Math.round(capture.amountUSD * 100)
          : order.expected_amount_cents;

        const { data: fulfillRes, error: fulfillErr } = await adminClient.rpc('fulfill_order', {
          p_order_id: order.id,
          p_capture_id: capture.captureId || `cap-${Date.now()}`,
          p_amount_cents: capturedAmountCents,
          p_currency: capture.currency || 'USD',
        });

        if (fulfillErr) {
          throw new Error(fulfillErr.message);
        }

        if (!fulfillRes?.success) {
          return NextResponse.json({ error: fulfillRes?.error || 'Order fulfillment failed' }, { status: 422 });
        }

        let dbProject = null;
        let rpcBalance: number | undefined;
        if (projectPayload && typeof projectPayload === 'object') {
          const raw = projectPayload as Record<string, any>;
          if (raw.projectId) {
            const res = await createOrFetchProjectForOrder(raw);
            dbProject = res.project;
            rpcBalance = res.rpcBalance;
          }
        }

        const { data: latestWallet } = await adminClient
          .from('wallets')
          .select('balance_credits')
          .eq('user_id', order.user_id)
          .maybeSingle();

        const finalWalletBalance =
          rpcBalance ?? latestWallet?.balance_credits ?? fulfillRes.new_balance;

        // Major action notification: Payment received
        void createNotification({
          userId: order.user_id,
          type: 'payment_confirmed',
          title: 'Payment received',
          email: {
            category: 'payment_receipt_client',
            badge: 'Payment Receipt',
            subject: `Payment receipt · $${(capturedAmountCents / 100).toFixed(2)}`,
            details: [
              ['Amount paid', `$${(capturedAmountCents / 100).toFixed(2)} ${capture.currency || 'USD'}`],
              ['Order ID', order.id],
              ['PayPal capture ID', capture.captureId || '—'],
              ['Credits added', String(fulfillRes.credits_granted ?? 0)],
              ['Wallet balance', `${finalWalletBalance ?? 0} Credits`],
              ['Date', new Date().toUTCString()],
            ],
          },
          message: `We received your payment of $${(capturedAmountCents / 100).toFixed(2)}.`,
          link: '/projects',
          actionLabel: 'View Projects',
          actionId: order.id,
        });

        void notifyAdmins({
          type: 'order_status',
          title: 'New paid order',
          email: {
            category: 'payment_received_owner',
            badge: 'New Payment',
            subject: `[Studio Alert] New payment $${(capturedAmountCents / 100).toFixed(2)} from ${user.email}`,
            details: [
              ['Client', user.email || '—'],
              ['Amount', `$${(capturedAmountCents / 100).toFixed(2)} ${capture.currency || 'USD'}`],
              ['Order ID', order.id],
              ['Credits granted', String(fulfillRes.credits_granted ?? 0)],
            ],
          },
          message: `${user.email} paid $${(capturedAmountCents / 100).toFixed(2)}.`,
          link: `/management/ledger`,
          actionLabel: 'View Ledger',
          actionId: order.id,
        });

        return NextResponse.json({
          success: true,
          status: 'fulfilled',
          creditsGranted: fulfillRes.credits_granted,
          newWalletBalance: finalWalletBalance,
          project: dbProject,
          message: dbProject
            ? 'Payment completed and project launched!'
            : 'Payment completed! Credits were deposited to your Studio Wallet — click Confirm to launch your project.',
        });
      } else if (capture.status === 'PENDING') {
        await adminClient
          .from('orders')
          .update({ status: 'capture_pending' })
          .eq('id', order.id);

        return NextResponse.json({
          success: true,
          status: 'capture_pending',
          message: 'Payment is pending settlement. Your credits will be automatically credited once verified by PayPal.',
        });
      } else {
        await adminClient
          .from('orders')
          .update({ status: 'denied' })
          .eq('id', order.id);

        return NextResponse.json({
          success: false,
          status: capture.status,
          error: 'Payment was not approved or was denied by PayPal.',
        }, { status: 402 });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not capture PayPal order';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // 2. Dev Mock Fallback (strictly disabled in production)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 });
  }
  const userEmail = (user.email || 'kira@example.com').toLowerCase().trim();
  const granted = 660;
  const newBal = adjustUserBalance(userEmail, granted, 'PayPal mock payment captured');

  return NextResponse.json({
    success: true,
    status: 'fulfilled',
    creditsGranted: granted,
    newWalletBalance: newBal,
    message: 'Mock payment captured successfully.',
  });
}
