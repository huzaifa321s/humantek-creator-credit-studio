import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';

export type NotificationType =
  | 'project_status'
  | 'payment_confirmed'
  | 'wallet_credit'
  | 'chat_message'
  | 'order_status'
  | 'system_alert';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  actionLabel?: string;
  actionId?: string;
}

/**
 * Creates a persistent notification for a specific user.
 * Handled via service role client (bypasses RLS for secure system insertion).
 */
export async function createNotification(params: CreateNotificationParams): Promise<string | null> {
  try {
    const admin = createAdminClient();
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
        is_read: false,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[Notifications] Failed to create notification:', error.message);
      return null;
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
      .select('id')
      .eq('role', 'admin');

    if (error || !admins?.length) return;

    const rows = admins.map((a) => ({
      user_id: a.id,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      link: params.link || null,
      action_label: params.actionLabel || null,
      action_id: params.actionId || null,
      is_read: false,
    }));

    await admin.from('notifications').insert(rows);
  } catch (err) {
    console.warn('[Notifications] Failed to broadcast to admins:', err);
  }
}
