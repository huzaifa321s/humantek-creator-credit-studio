import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPayPalWebhookSignature } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request payload' }, { status: 400 });
  }

  // 1. Signature Verification
  const isVerified = await verifyPayPalWebhookSignature(req.headers, rawBody);
  if (!isVerified) {
    console.warn('[PayPal Webhook] Signature verification failed or unauthorized forged payload received.');
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let eventPayload: Record<string, any>;
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const eventId = eventPayload.id;
  const eventType = eventPayload.event_type;
  const resource = eventPayload.resource || {};

  if (!eventId || !eventType) {
    return NextResponse.json({ error: 'Missing event ID or event type' }, { status: 400 });
  }

  // If Supabase not configured (pure dev/mock)
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, mock: true }, { status: 200 });
  }

  const adminClient = createAdminClient();

  // 2. Ingestion & Retry-Safe Deduplication
  // A duplicate event ID returns 200 immediately ONLY IF its stored status is 'processed' or 'ignored'.
  // If the event is in 'received' or 'failed' status (e.g. from an earlier transient error), it MUST be reprocessed.
  let webhookDbId: number;

  const { data: existingEvent } = await adminClient
    .from('webhook_events')
    .select('id, status')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existingEvent) {
    if (existingEvent.status === 'processed' || existingEvent.status === 'ignored') {
      return NextResponse.json({ success: true, replayed: true, status: existingEvent.status }, { status: 200 });
    }
    // Failed or received: reprocess the event
    webhookDbId = existingEvent.id;
  } else {
    const { data: loggedEvent, error: insertErr } = await adminClient
      .from('webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType,
        payload: eventPayload,
        status: 'received',
      })
      .select('id')
      .single();

    if (insertErr || !loggedEvent) {
      if (insertErr?.code === '23505') {
        const { data: retryCheck } = await adminClient
          .from('webhook_events')
          .select('id, status')
          .eq('event_id', eventId)
          .single();
        if (retryCheck?.status === 'processed' || retryCheck?.status === 'ignored') {
          return NextResponse.json({ success: true, replayed: true, status: retryCheck.status }, { status: 200 });
        }
        webhookDbId = retryCheck?.id ?? 0;
      } else {
        console.error('Failed to log webhook event in database:', insertErr);
        return NextResponse.json({ error: 'Database logging failed' }, { status: 500 });
      }
    } else {
      webhookDbId = loggedEvent.id;
    }
  }

  try {
    // 3. Locate Associated Order
    const customId = resource.custom_id;
    const providerOrderId =
      resource.supplementary_data?.related_ids?.order_id ||
      resource.order_id ||
      (eventType.startsWith('CHECKOUT.ORDER') ? resource.id : undefined);

    let orderQuery = adminClient.from('orders').select('*');
    if (customId && customId.includes('-') && customId.length === 36) {
      orderQuery = orderQuery.eq('id', customId);
    } else if (providerOrderId) {
      orderQuery = orderQuery.eq('provider_order_id', providerOrderId);
    } else {
      orderQuery = orderQuery.or(`provider_capture_id.eq.${resource.id},provider_order_id.eq.${resource.id}`);
    }

    const { data: order } = await orderQuery.maybeSingle();

    if (order && webhookDbId) {
      await adminClient
        .from('webhook_events')
        .update({ order_id: order.id })
        .eq('id', webhookDbId);
    }

    // 4. Process Specific Event Types
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        if (!order) {
          console.warn(`[PayPal Webhook] Order not found for completed capture: ${resource.id}`);
          break;
        }

        const value = resource.amount?.value;
        const currency = resource.amount?.currency_code || 'USD';
        const amountCents = value !== undefined ? Math.round(Number(value) * 100) : order.expected_amount_cents;

        // Fulfill order: The ONLY place credits are granted
        const { data: fulfillRes, error: fulfillErr } = await adminClient.rpc('fulfill_order', {
          p_order_id: order.id,
          p_capture_id: resource.id,
          p_amount_cents: amountCents,
          p_currency: currency,
        });

        if (fulfillErr) {
          throw new Error(`Order fulfillment error: ${fulfillErr.message}`);
        }
        if (!fulfillRes?.success && !fulfillRes?.already_fulfilled) {
          throw new Error(`Order fulfillment rejected: ${fulfillRes?.error || 'unknown'}`);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED': {
        if (order) {
          await adminClient.from('orders').update({ status: 'denied' }).eq('id', order.id);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.PENDING': {
        if (order && order.status === 'created') {
          await adminClient.from('orders').update({ status: 'capture_pending' }).eq('id', order.id);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        if (!order) break;

        const refundId = resource.id || `ref-${Date.now()}`;
        const refundAmountCents = resource.amount?.value
          ? Math.round(Number(resource.amount.value) * 100)
          : order.expected_amount_cents;

        const { error: refundErr } = await adminClient.rpc('handle_refund', {
          p_order_id: order.id,
          p_refund_id: refundId,
          p_refund_amount_cents: refundAmountCents,
          p_reason: 'PayPal webhook refund',
        });

        if (refundErr) {
          throw new Error(`Refund handler error: ${refundErr.message}`);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REVERSED': {
        if (!order) break;

        const reversalId = resource.id || `rev-${Date.now()}`;
        const { error: revErr } = await adminClient.rpc('handle_reversal', {
          p_order_id: order.id,
          p_reversal_id: reversalId,
          p_reason: 'PayPal chargeback / reversal',
        });

        if (revErr) {
          throw new Error(`Reversal handler error: ${revErr.message}`);
        }
        break;
      }

      case 'CUSTOMER.DISPUTE.CREATED': {
        if (!order) break;

        const disputeId = resource.id || `dispute-${Date.now()}`;
        const { error: disputeErr } = await adminClient.rpc('handle_dispute', {
          p_order_id: order.id,
          p_dispute_id: disputeId,
          p_reason: resource.dispute_reason || 'Customer dispute opened on PayPal',
        });

        if (disputeErr) {
          throw new Error(`Dispute freeze error: ${disputeErr.message}`);
        }
        break;
      }

      case 'CHECKOUT.ORDER.APPROVED': {
        // Spec rule: Don't fulfill on CHECKOUT.ORDER.APPROVED, because it fires before money is captured
        if (order && order.status === 'created') {
          await adminClient.from('orders').update({ status: 'approved' }).eq('id', order.id);
        }
        break;
      }

      default: {
        // Ignore unhandled events safely
        if (webhookDbId) {
          await adminClient
            .from('webhook_events')
            .update({ status: 'ignored', processed_at: new Date().toISOString() })
            .eq('id', webhookDbId);
        }
        return NextResponse.json({ success: true, ignored: true }, { status: 200 });
      }
    }

    // 5. Update Webhook Status to 'processed' ONLY after successful execution
    if (webhookDbId) {
      await adminClient
        .from('webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookDbId);
    }

    return NextResponse.json({ success: true, processed: true }, { status: 200 });
  } catch (err: any) {
    console.error('[PayPal Webhook] Error during event processing:', err);

    if (webhookDbId) {
      await adminClient
        .from('webhook_events')
        .update({
          status: 'failed',
          error: err.message || 'Unknown processing error',
        })
        .eq('id', webhookDbId);
    }

    // Return 500 so PayPal will retry delivery
    return NextResponse.json({ error: 'Processing error occurred' }, { status: 500 });
  }
}
