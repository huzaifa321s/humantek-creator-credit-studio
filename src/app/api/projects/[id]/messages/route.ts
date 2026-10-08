import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.adobe.photoshop',
  'application/illustrator',
]);

const MAX_ATTACHMENT_SIZE = 52428800; // 50 MB

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify membership or admin role
    const { data: project, error: projErr } = await admin
      .from('projects')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!user.isAdmin && project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const afterIdParam = searchParams.get('after_id');
    const beforeIdParam = searchParams.get('before_id');
    const limitParam = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    let query = admin
      .from('project_messages')
      .select('id, project_id, sender_id, kind, body, client_message_id, created_at, profiles(id, email, role)')
      .eq('project_id', id);

    let isReversed = false;

    if (afterIdParam) {
      // Overlap fetch window: max(0, afterId - 50) to catch any out-of-order committed transactions
      const safeAfterId = Math.max(0, parseInt(afterIdParam, 10) - 50);
      query = query.gt('id', safeAfterId).order('id', { ascending: true }).limit(limitParam);
    } else if (beforeIdParam) {
      // History fetch for older messages
      const beforeId = parseInt(beforeIdParam, 10);
      query = query.lt('id', beforeId).order('id', { ascending: false }).limit(limitParam);
      isReversed = true;
    } else {
      // Initial fetch: latest messages
      query = query.order('id', { ascending: false }).limit(limitParam);
      isReversed = true;
    }

    const { data: rawMessages, error: msgErr } = await query;
    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const messages = isReversed ? (rawMessages || []).reverse() : rawMessages || [];

    // Attachments query with signed URLs
    const messageIds = messages.map((m) => m.id);
    let attachmentsByMsgId: Record<number, any[]> = {};

    if (messageIds.length > 0) {
      const { data: attachments } = await admin
        .from('project_message_attachments')
        .select('*')
        .in('message_id', messageIds);

      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          let signedUrl = null;
          try {
            const { data: signed } = await admin.storage
              .from('project-attachments')
              .createSignedUrl(att.storage_path, 3600);
            signedUrl = signed?.signedUrl || null;
          } catch {
            signedUrl = null;
          }

          if (!attachmentsByMsgId[att.message_id]) {
            attachmentsByMsgId[att.message_id] = [];
          }
          attachmentsByMsgId[att.message_id].push({
            id: att.id,
            fileName: att.file_name,
            fileSize: att.file_size,
            mimeType: att.mime_type,
            storagePath: att.storage_path,
            url: signedUrl,
            isDeliverable: att.is_deliverable,
            createdAt: att.created_at,
          });
        }
      }
    }

    // Get current user's read state
    const { data: readState } = await admin
      .from('project_read_states')
      .select('last_read_message_id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    const formattedMessages = messages.map((m: any) => ({
      id: m.id,
      projectId: m.project_id,
      senderId: m.sender_id,
      kind: m.kind,
      body: m.body,
      clientMessageId: m.client_message_id,
      createdAt: m.created_at,
      sender: m.profiles
        ? {
            id: m.profiles.id,
            name: m.profiles.full_name || 'Studio Member',
            email: m.profiles.email,
            role: m.profiles.role,
          }
        : null,
      attachments: attachmentsByMsgId[m.id] || [],
    }));

    return NextResponse.json({
      messages: formattedMessages,
      lastReadId: readState?.last_read_message_id || 0,
    });
  } catch (err: any) {
    console.error('Error in GET /api/projects/[id]/messages:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate Limiting: 5 messages per 10 seconds per user
    const rl = checkRateLimit(`msg:${user.id}`, 5, 10_000);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please wait a few seconds before sending another message.',
          resetInMs: rl.resetInMs,
        },
        { status: 429 }
      );
    }

    const admin = createAdminClient();

    // Verify membership or admin
    const { data: project, error: projErr } = await admin
      .from('projects')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!user.isAdmin && project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const content = (body.body || '').trim();
    if (!content) {
      return NextResponse.json({ error: 'Message body cannot be empty' }, { status: 400 });
    }

    if (content.length > 4000) {
      return NextResponse.json({ error: 'Message body exceeds 4,000 characters' }, { status: 400 });
    }

    const clientMessageId = body.clientMessageId
      ? String(body.clientMessageId).trim().slice(0, 128)
      : null;

    if (!clientMessageId) {
      return NextResponse.json({ error: 'clientMessageId is required for idempotency' }, { status: 400 });
    }

    // Attachment validation (Strict isolation: cannot attach files belonging to other projects)
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    for (const att of attachments) {
      if (!att.storagePath || typeof att.storagePath !== 'string') {
        return NextResponse.json({ error: 'Invalid storagePath for attachment' }, { status: 400 });
      }

      // Foreign project isolation check
      if (!att.storagePath.startsWith(`projects/${id}/`)) {
        return NextResponse.json(
          { error: 'Attachment storagePath must belong to this project' },
          { status: 400 }
        );
      }

      if (!att.mimeType || !ALLOWED_MIME_TYPES.has(att.mimeType.toLowerCase())) {
        return NextResponse.json(
          { error: `File type ${att.mimeType || 'unknown'} is not allowed.` },
          { status: 400 }
        );
      }

      if (att.mimeType.toLowerCase().includes('svg')) {
        return NextResponse.json({ error: 'Inline SVG files are prohibited for security' }, { status: 400 });
      }

      if (!att.fileSize || att.fileSize > MAX_ATTACHMENT_SIZE) {
        return NextResponse.json({ error: 'Attachment exceeds maximum 50 MB limit' }, { status: 400 });
      }
    }

    // Insert message via service_role admin client
    const { data: newMsg, error: insertErr } = await admin
      .from('project_messages')
      .insert({
        project_id: id,
        sender_id: user.id, // Strictly server-assigned
        kind: 'user',
        body: content,
        client_message_id: clientMessageId,
      })
      .select('id, project_id, sender_id, kind, body, client_message_id, created_at, profiles(id, email, role)')
      .single();

    if (insertErr) {
      // Idempotency: Unique constraint (project_id, sender_id, client_message_id)
      if (insertErr.code === '23505') {
        const { data: existingMsg } = await admin
          .from('project_messages')
          .select('id, project_id, sender_id, kind, body, client_message_id, created_at, profiles(id, email, role)')
          .eq('project_id', id)
          .eq('sender_id', user.id)
          .eq('client_message_id', clientMessageId)
          .single();

        return NextResponse.json({
          success: true,
          replayed: true,
          message: existingMsg,
        });
      }

      console.error('Error inserting message:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Insert validated attachments
    const createdAttachments = [];
    for (const att of attachments) {
      const { data: attRow, error: attErr } = await admin
        .from('project_message_attachments')
        .insert({
          message_id: newMsg.id,
          project_id: id,
          storage_path: att.storagePath,
          file_name: att.fileName || 'attachment',
          file_size: att.fileSize,
          mime_type: att.mimeType,
          is_deliverable: Boolean(user.isAdmin && att.isDeliverable),
        })
        .select()
        .single();

      if (!attErr && attRow) {
        createdAttachments.push(attRow);
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        ...newMsg,
        attachments: createdAttachments,
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/projects/[id]/messages:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify membership or admin
    const { data: project, error: projErr } = await admin
      .from('projects')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!user.isAdmin && project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const requestedId = parseInt(body?.messageId, 10);
    if (isNaN(requestedId) || requestedId < 0) {
      return NextResponse.json({ error: 'Valid positive messageId required' }, { status: 400 });
    }

    // Cap requestedId at the maximum message ID in this project
    const { data: maxRow } = await admin
      .from('project_messages')
      .select('id')
      .eq('project_id', id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    const safeMessageId = Math.min(requestedId, maxRow?.id || 0);

    // Upsert read state: update only if safeMessageId is greater than current
    const { data: existingState } = await admin
      .from('project_read_states')
      .select('last_read_message_id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    const newLastRead = Math.max(existingState?.last_read_message_id || 0, safeMessageId);

    const { error: upsertErr } = await admin.from('project_read_states').upsert({
      project_id: id,
      user_id: user.id,
      last_read_message_id: newLastRead,
      updated_at: new Date().toISOString(),
    });

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lastReadId: newLastRead });
  } catch (err: any) {
    console.error('Error in PATCH /api/projects/[id]/messages:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
