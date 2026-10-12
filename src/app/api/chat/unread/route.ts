import { NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** How many recently active conversations are checked for unread messages. */
const MAX_PROJECTS = 50;
/** Upper bound on unread rows scanned, so a very busy inbox stays cheap. */
const MAX_UNREAD_ROWS = 2000;

/**
 * Unread chat counts per project for the current user.
 * A message is unread when it was sent by someone else after the user's last read message.
 */
export async function GET() {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isSupabaseConfigured() || user.isDevFallback) {
      return NextResponse.json({ counts: {}, total: 0 });
    }

    const admin = createAdminClient();

    let projectsQuery = admin
      .from('projects')
      .select('id')
      .not('last_message_at', 'is', null)
      .order('last_message_at', { ascending: false })
      .limit(MAX_PROJECTS);
    if (!user.isAdmin) {
      projectsQuery = projectsQuery.eq('user_id', user.id);
    }

    const { data: projects, error: projErr } = await projectsQuery;
    if (projErr) {
      return NextResponse.json({ error: projErr.message }, { status: 500 });
    }

    const projectIds = (projects || []).map((p) => p.id as string);
    if (!projectIds.includes('global')) {
      projectIds.push('global');
    }

    const { data: readStates } = await admin
      .from('project_read_states')
      .select('project_id, last_read_message_id')
      .eq('user_id', user.id)
      .in('project_id', projectIds);

    const lastRead = new Map<string, number>();
    for (const r of readStates || []) {
      lastRead.set(r.project_id as string, Number(r.last_read_message_id) || 0);
    }
    const minLastRead = Math.min(...projectIds.map((id) => lastRead.get(id) ?? 0));

    const { data: rows, error: msgErr } = await admin
      .from('project_messages')
      .select('id, project_id')
      .in('project_id', projectIds)
      .neq('sender_id', user.id)
      .eq('kind', 'user')
      .gt('id', minLastRead)
      .order('id', { ascending: false })
      .limit(MAX_UNREAD_ROWS);

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of rows || []) {
      const pid = row.project_id as string;
      if (Number(row.id) > (lastRead.get(pid) ?? 0)) {
        counts[pid] = (counts[pid] || 0) + 1;
        total += 1;
      }
    }

    return NextResponse.json({ counts, total });
  } catch (err) {
    console.error('Error in GET /api/chat/unread:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
