import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

// 1. GET /api/notifications: Fetch current user's notifications and unread count
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '30', 10), 1), 100);

    let query = supabase
      .from('notifications')
      .select('id, type, title, message, link, action_label, action_id, entity_type, entity_id, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filter === 'unread') {
      query = query.eq('is_read', false);
    } else if (filter === 'projects') {
      query = query.in('type', ['project_status', 'order_status']);
    } else if (filter === 'payments') {
      query = query.in('type', ['payment_confirmed', 'wallet_credit']);
    } else if (filter === 'messages') {
      query = query.eq('type', 'chat_message');
    }

    const { data: notifications, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // Get exact unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    const sanitizedNotifications = (notifications || []).map((n) => ({
      ...n,
      message:
        n.message && /final files.*ready to download/i.test(n.message)
          ? 'Your project has been marked as completed.'
          : n.message,
      action_label:
        n.action_label && /download\s*files/i.test(n.action_label)
          ? 'View Project'
          : n.action_label,
    }));

    return NextResponse.json(
      {
        ok: true,
        notifications: sanitizedNotifications,
        unreadCount: unreadCount || 0,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch notifications';
    return NextResponse.json({ error: msg }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

// 2. PATCH /api/notifications: Mark single notification or all as read
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, mark_all_read, is_read = true } = body;

    if (mark_all_read) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: 'All notifications marked as read' });
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: Boolean(is_read) })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update notification';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// 3. DELETE /api/notifications: Delete single notification or clear read
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, clear_read } = body;

    if (clear_read) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: 'Read notifications cleared' });
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete notification';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
