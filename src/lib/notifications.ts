import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import {
  buildStudioNotificationEmail,
  sendStudioEmail,
  type StudioEmailAttachment,
  type StudioEmailPayload,
} from '@/lib/email';

export type NotificationType =
  | 'project_status'
  | 'payment_confirmed'
  | 'wallet_credit'
  | 'chat_message'
  | 'order_status'
  | 'system_alert';

export type NotificationEntityType = 'project' | 'order' | 'wallet' | 'chat' | 'system';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  actionLabel?: string;
  actionId?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  /** Also deliver this notification by email (SMTP). */
  email?: NotificationEmailOptions;
}

export interface NotificationEmailOptions {
  category: StudioEmailPayload['category'];
  badge: string;
  /** Defaults to the notification title. */
  subject?: string;
  details?: Array<[label: string, value: string]>;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  attachments?: StudioEmailAttachment[];
  /** Only email when the recipient has no other unread notification for the same entity (used for chat alerts). */
  onlyIfFirstUnread?: boolean;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function hasUnreadForEntity(
  admin: AdminClient,
  userId: string,
  params: Omit<CreateNotificationParams, 'userId'>,
  entityId: string | null
): Promise<boolean> {
  if (!entityId) return false;
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', params.type)
    .eq('entity_id', entityId)
    .eq('is_read', false);
  return (count || 0) > 0;
}

async function emailNotification(
  recipient: { email?: string | null; full_name?: string | null },
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  const opts = params.email;
  if (!opts || !recipient.email) return;
  const greetingName =
    (recipient.full_name || '').trim() || recipient.email.split('@')[0] || undefined;
  await sendStudioEmail(
    buildStudioNotificationEmail({
      to: recipient.email,
      category: opts.category,
      subject: opts.subject || params.title,
      badge: opts.badge,
      heading: params.title,
      message: params.message,
      greetingName,
      details: opts.details,
      ctaLabel: params.actionLabel,
      ctaUrl: params.link,
      secondaryCtaLabel: opts.secondaryCtaLabel,
      secondaryCtaUrl: opts.secondaryCtaUrl,
      attachments: opts.attachments,
    })
  );
}

function inferEntityType(params: Omit<CreateNotificationParams, 'userId'>): NotificationEntityType | null {
  if (params.entityType) return params.entityType;
  switch (params.type) {
    case 'project_status':
      return 'project';
    case 'chat_message':
      return 'chat';
    case 'wallet_credit':
    case 'payment_confirmed':
      return 'wallet';
    case 'order_status':
      return 'order';
    default:
      return null;
  }
}

/**
 * Creates a persistent notification for a specific user.
 * Handled via service role client (bypasses RLS for secure system insertion).
 */
export async function createNotification(params: CreateNotificationParams): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const resolvedEntityType = inferEntityType(params);
    const resolvedEntityId = params.entityId || (params.actionId && params.actionId !== 'open-chat' ? params.actionId : null);
    const skipEmail =
      params.email?.onlyIfFirstUnread &&
      (await hasUnreadForEntity(admin, params.userId, params, resolvedEntityId));

    const { data, error } = await admin
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title.trim(),
        message: params.message.trim(),
        link: params.link || null,
        action_label: params.actionLabel || null,
        action_id: params.actionId || null,
        entity_type: resolvedEntityType,
        entity_id: resolvedEntityId,
        is_read: false,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[Notifications] Failed to create notification:', error.message);
      return null;
    }

    if (params.email && !skipEmail) {
      const { data: profile } = await admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', params.userId)
        .maybeSingle();
      if (profile) await emailNotification(profile, params);
    }

    return data?.id || null;
  } catch (err) {
    console.warn('[Notifications] Unexpected error:', err);
    return null;
  }
}

/**
 * Broadcasts an alert or notification to all administrator accounts.
 */
export async function notifyAdmins(
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: admins, error } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'admin');

    if (error || !admins?.length) return;

    const resolvedEntityType = inferEntityType(params);
    const resolvedEntityId = params.entityId || (params.actionId && params.actionId !== 'open-chat' ? params.actionId : null);

    const rows = admins.map((a) => ({
      user_id: a.id,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      link: params.link || null,
      action_label: params.actionLabel || null,
      action_id: params.actionId || null,
      entity_type: resolvedEntityType,
      entity_id: resolvedEntityId,
      is_read: false,
    }));

    const emailRecipients = params.email
      ? (
          await Promise.all(
            admins.map(async (a) =>
              params.email?.onlyIfFirstUnread &&
              (await hasUnreadForEntity(admin, a.id, params, resolvedEntityId))
                ? null
                : a
            )
          )
        ).filter((a): a is (typeof admins)[number] => Boolean(a))
      : [];

    await admin.from('notifications').insert(rows);

    await Promise.all(emailRecipients.map((a) => emailNotification(a, params)));
  } catch (err) {
    console.warn('[Notifications] Failed to broadcast to admins:', err);
  }
}
