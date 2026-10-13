import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { createNotification, notifyAdmins } from '@/lib/notifications';
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

interface MessageEnvelope {
  v: 1;
  text: string;
  replyTo?: {
    id: string;
    senderName: string;
    senderRole?: string;
    content: string;
  } | null;
  likes?: Array<{
    userId: string;
    userName: string;
    likedAt?: string;
  }>;
  isEdited?: boolean;
  editedAt?: string | null;
  isDeleted?: boolean;
}

interface MessageProfile {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
}

interface MessageRow {
  id: number;
  project_id: string;
  sender_id: string;
  kind: string;
  body: string;
  client_message_id: string | null;
  created_at: string;
  profiles?: MessageProfile | MessageProfile[] | null;
}

interface AttachmentItem {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  storagePath: string;
  url: string | null;
  isDeliverable: boolean;
  createdAt: string;
}

function extractSenderProfile(
  profiles: MessageProfile | MessageProfile[] | null | undefined
): MessageProfile | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) {
    return profiles[0] || null;
  }
  return profiles;
}

function parseMessageBody(rawBody: string): {
  body: string;
  replyTo: { id: string; senderName: string; senderRole?: string; content: string } | null;
  likes: Array<{ userId: string; userName: string; likedAt?: string }>;
  isEdited: boolean;
  editedAt: string | null;
  isDeleted: boolean;
} {
  if (typeof rawBody === 'string' && rawBody.startsWith('{"v":1,')) {
    try {
      const parsed: MessageEnvelope = JSON.parse(rawBody);
      return {
        body: parsed.text || '',
        replyTo: parsed.replyTo || null,
        likes: Array.isArray(parsed.likes) ? parsed.likes : [],
        isEdited: Boolean(parsed.isEdited),
        editedAt: parsed.editedAt || null,
        isDeleted: Boolean(parsed.isDeleted),
      };
    } catch {
      // Fallback to raw string
    }
  }
  return {
    body: rawBody || '',
    replyTo: null,
    likes: [],
    isEdited: false,
    editedAt: null,
    isDeleted: false,
  };
}

function encodeMessageBody(
  text: string,
  meta?: {
    replyTo?: { id: string; senderName: string; senderRole?: string; content: string } | null;
    likes?: Array<{ userId: string; userName: string; likedAt?: string }>;
    isEdited?: boolean;
    editedAt?: string | null;
    isDeleted?: boolean;
  }
): string {
  if (meta && (meta.replyTo || (meta.likes && meta.likes.length > 0) || meta.isEdited || meta.isDeleted)) {
    const envelope: MessageEnvelope = {
      v: 1,
      text: meta.isDeleted ? '' : text,
      replyTo: meta.isDeleted ? null : (meta.replyTo || null),
      likes: meta.isDeleted ? [] : (meta.likes || []),
      isEdited: Boolean(meta.isEdited),
      editedAt: meta.editedAt || null,
      isDeleted: Boolean(meta.isDeleted),
    };
    return JSON.stringify(envelope);
  }
  return text;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const isGlobal = id === 'global';
    let projectClientName: string | null = null;

    if (!isGlobal) {
      // Verify membership or admin role
      const { data: project, error: projErr } = await admin
        .from('projects')
        .select('id, user_id, client_name')
        .eq('id', id)
        .single();

      if (projErr || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      if (!user.isAdmin && project.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      projectClientName = project.client_name || null;
    }

    const searchParams = req.nextUrl.searchParams;
    const afterIdParam = searchParams.get('after_id');
    const beforeIdParam = searchParams.get('before_id');
    const limitParam = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    let query = admin
      .from('project_messages')
      .select('id, project_id, sender_id, kind, body, client_message_id, created_at, profiles(id, email, full_name, role)')
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
    const attachmentsByMsgId: Record<number, AttachmentItem[]> = {};

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

    const formattedMessages = messages.map((m) => {
      const row = m as unknown as MessageRow;
      const parsed = parseMessageBody(row.body);
      const profile = extractSenderProfile(row.profiles);
      return {
        id: row.id,
        projectId: row.project_id,
        senderId: row.sender_id,
        kind: row.kind,
        body: parsed.body,
        replyTo: parsed.replyTo,
        likes: parsed.likes,
        isEdited: parsed.isEdited,
        editedAt: parsed.editedAt,
        isDeleted: parsed.isDeleted,
        clientMessageId: row.client_message_id,
        createdAt: row.created_at,
        sender: profile
          ? {
              id: profile.id || row.sender_id,
              name: profile.full_name || (profile.role === 'admin' || profile.role === 'manager' ? 'Humantek Studio' : (projectClientName || null)),
              email: profile.email,
              role: profile.role,
            }
          : null,
        attachments: attachmentsByMsgId[row.id] || [],
      };
    });

    return NextResponse.json({
      messages: formattedMessages,
      lastReadId: readState?.last_read_message_id || 0,
    });
  } catch (err: unknown) {
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
    const isGlobal = id === 'global';
    let postProjectClientName: string | null = null;
    let projectUserId: string | null = null;

    if (!isGlobal) {
      // Verify membership or admin
      const { data: project, error: projErr } = await admin
        .from('projects')
        .select('id, user_id, client_name')
        .eq('id', id)
        .single();

      if (projErr || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      if (!user.isAdmin && project.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      postProjectClientName = project.client_name || null;
      projectUserId = project.user_id || null;
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const content = (body.body || '').trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if (!content && attachments.length === 0) {
      return NextResponse.json({ error: 'Message body cannot be empty' }, { status: 400 });
    }
    if (attachments.length > 5) {
      return NextResponse.json({ error: 'You can attach up to 5 files per message' }, { status: 400 });
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

    const replyTo = body.replyTo && body.replyTo.id
      ? {
          id: String(body.replyTo.id),
          senderName: String(body.replyTo.senderName || 'Humantek Studio'),
          senderRole: body.replyTo.senderRole ? String(body.replyTo.senderRole) : undefined,
          content: String(body.replyTo.content || '').slice(0, 300),
        }
      : null;

    const encodedBody = encodeMessageBody(content, { replyTo });

    // Insert message via service_role admin client
    const { data: newMsg, error: insertErr } = await admin
      .from('project_messages')
      .insert({
        project_id: id,
        sender_id: user.id, // Strictly server-assigned
        kind: 'user',
        body: encodedBody,
        client_message_id: clientMessageId,
      })
      .select('id, project_id, sender_id, kind, body, client_message_id, created_at, profiles(id, email, full_name, role)')
      .single();

    if (insertErr) {
      // Idempotency: Unique constraint (project_id, sender_id, client_message_id)
      if (insertErr.code === '23505') {
        const { data: existingMsg } = await admin
          .from('project_messages')
          .select('id, project_id, sender_id, kind, body, client_message_id, created_at, profiles(id, email, full_name, role)')
          .eq('project_id', id)
          .eq('sender_id', user.id)
          .eq('client_message_id', clientMessageId)
          .single();

        const parsedExisting = existingMsg ? parseMessageBody(existingMsg.body) : null;
        return NextResponse.json({
          success: true,
          replayed: true,
          message: existingMsg
            ? {
                ...existingMsg,
                body: parsedExisting?.body || existingMsg.body,
                replyTo: parsedExisting?.replyTo || null,
                likes: parsedExisting?.likes || [],
                isEdited: parsedExisting?.isEdited || false,
                editedAt: parsedExisting?.editedAt || null,
                isDeleted: parsedExisting?.isDeleted || false,
              }
            : null,
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
        let signedUrl: string | null = null;
        try {
          const { data: signed } = await admin.storage
            .from('project-attachments')
            .createSignedUrl(attRow.storage_path, 3600);
          signedUrl = signed?.signedUrl || null;
        } catch {
          signedUrl = null;
        }
        createdAttachments.push({
          id: attRow.id,
          fileName: attRow.file_name,
          fileSize: attRow.file_size,
          mimeType: attRow.mime_type,
          storagePath: attRow.storage_path,
          url: signedUrl,
          isDeliverable: attRow.is_deliverable,
          createdAt: attRow.created_at,
        });
      }
    }

    const parsedNew = parseMessageBody(newMsg.body);
    const newSenderProfile = extractSenderProfile((newMsg as unknown as MessageRow).profiles);

    const response = NextResponse.json({
      success: true,
      message: {
        id: newMsg.id,
        projectId: newMsg.project_id,
        senderId: newMsg.sender_id,
        kind: newMsg.kind,
        body: parsedNew.body,
        replyTo: parsedNew.replyTo,
        likes: parsedNew.likes,
        isEdited: parsedNew.isEdited,
        editedAt: parsedNew.editedAt,
        isDeleted: parsedNew.isDeleted,
        clientMessageId: newMsg.client_message_id,
        createdAt: newMsg.created_at,
        sender: newSenderProfile
          ? {
              id: newSenderProfile.id || newMsg.sender_id,
              name: newSenderProfile.full_name || (user.isAdmin ? 'Humantek Studio' : (postProjectClientName || null)),
              email: newSenderProfile.email || user.email,
              role: newSenderProfile.role || user.role,
            }
          : null,
        attachments: createdAttachments,
      },
    });

    // Major action notification: New message
    if (!isGlobal) {
      if (user.isAdmin) {
        if (projectUserId && projectUserId !== user.id) {
          void createNotification({
            userId: projectUserId,
            type: 'chat_message',
            title: 'New message',
            message: 'Studio team sent you a message.',
            link: `/projects/${id}?tab=chat`,
            actionLabel: 'Open Chat',
            actionId: id,
          });
        }
      } else {
        const senderDisplay = postProjectClientName || (user.email ? user.email.split('@')[0] : 'Client');
        void notifyAdmins({
          type: 'chat_message',
          title: 'New client message',
          message: `${senderDisplay} sent a message.`,
          link: `/management?tab=projects&id=${id}&subtab=chat`,
          actionLabel: 'Open Chat',
          actionId: id,
        });
      }
    }

    return response;
  } catch (err: unknown) {
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
    const isGlobal = id === 'global';

    if (!isGlobal) {
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
    }

    const body = await req.json().catch(() => null);
    const action = body?.action || 'mark_read';
    const requestedId = parseInt(body?.messageId, 10);
    if (isNaN(requestedId) || requestedId < 0) {
      return NextResponse.json({ error: 'Valid positive messageId required' }, { status: 400 });
    }

    // ── ACTION: TOGGLE LIKE (Thumb Only) ──
    if (action === 'toggle_like') {
      const { data: targetMsg, error: fetchErr } = await admin
        .from('project_messages')
        .select('id, project_id, sender_id, body')
        .eq('id', requestedId)
        .eq('project_id', id)
        .single();

      if (fetchErr || !targetMsg) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      // Disallow liking own message
      if (targetMsg.sender_id === user.id) {
        return NextResponse.json({ error: 'Cannot like own message' }, { status: 400 });
      }

      const parsed = parseMessageBody(targetMsg.body);
      if (parsed.isDeleted) {
        return NextResponse.json({ error: 'Cannot like deleted message' }, { status: 400 });
      }

      const existingLikes = parsed.likes || [];
      const alreadyLiked = existingLikes.some((l) => l.userId === user.id);
      let updatedLikes: Array<{ userId: string; userName: string; likedAt?: string }>;

      if (alreadyLiked) {
        updatedLikes = existingLikes.filter((l) => l.userId !== user.id);
      } else {
        const userName =
          user.isAdmin ? 'Studio Team' : (user.email ? user.email.split('@')[0] : 'Creator');
        updatedLikes = [
          ...existingLikes,
          {
            userId: user.id,
            userName,
            likedAt: new Date().toISOString(),
          },
        ];
      }

      const newBody = encodeMessageBody(parsed.body, {
        ...parsed,
        likes: updatedLikes,
      });

      const { error: updateErr } = await admin
        .from('project_messages')
        .update({ body: newBody })
        .eq('id', requestedId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        messageId: requestedId,
        likes: updatedLikes,
      });
    }

    // ── ACTION: EDIT MESSAGE (Sender only, within 60 mins) ──
    if (action === 'edit') {
      const newText = (body?.content || '').trim();
      if (!newText) {
        return NextResponse.json({ error: 'Edited content cannot be empty' }, { status: 400 });
      }
      if (newText.length > 4000) {
        return NextResponse.json({ error: 'Message exceeds 4,000 characters' }, { status: 400 });
      }

      const { data: targetMsg, error: fetchErr } = await admin
        .from('project_messages')
        .select('id, project_id, sender_id, body, created_at')
        .eq('id', requestedId)
        .eq('project_id', id)
        .single();

      if (fetchErr || !targetMsg) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      if (!user.isAdmin && targetMsg.sender_id !== user.id) {
        return NextResponse.json({ error: 'Only the author can edit this message' }, { status: 403 });
      }

      const parsed = parseMessageBody(targetMsg.body);
      if (parsed.isDeleted) {
        return NextResponse.json({ error: 'Cannot edit deleted message' }, { status: 400 });
      }

      // Check 60 minute edit window
      const ageMs = Date.now() - new Date(targetMsg.created_at).getTime();
      if (ageMs > 60 * 60 * 1000) {
        return NextResponse.json(
          { error: 'Messages can only be edited within 60 minutes of sending' },
          { status: 400 }
        );
      }

      const editedAt = new Date().toISOString();
      const newBody = encodeMessageBody(newText, {
        ...parsed,
        isEdited: true,
        editedAt,
      });

      const { error: updateErr } = await admin
        .from('project_messages')
        .update({ body: newBody })
        .eq('id', requestedId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        messageId: requestedId,
        body: newText,
        isEdited: true,
        editedAt,
      });
    }

    // ── ACTION: DELETE MESSAGE (Sender or Admin, soft tombstone) ──
    if (action === 'delete') {
      const { data: targetMsg, error: fetchErr } = await admin
        .from('project_messages')
        .select('id, project_id, sender_id, body')
        .eq('id', requestedId)
        .eq('project_id', id)
        .single();

      if (fetchErr || !targetMsg) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      if (!user.isAdmin && targetMsg.sender_id !== user.id) {
        return NextResponse.json({ error: 'Only the author or admin can delete this message' }, { status: 403 });
      }

      const newBody = encodeMessageBody('', { isDeleted: true });

      const { error: updateErr } = await admin
        .from('project_messages')
        .update({ body: newBody })
        .eq('id', requestedId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        messageId: requestedId,
        isDeleted: true,
      });
    }

    // ── ACTION: MARK AS READ (Default) ──
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
  } catch (err: unknown) {
    console.error('Error in PATCH /api/projects/[id]/messages:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
