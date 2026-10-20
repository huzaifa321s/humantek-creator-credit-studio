import 'server-only';

/**
 * Server-side Realtime Event Trigger for the Company Server Pusher v7 Hub.
 *
 * When `NEXT_PUBLIC_CHAT_TRANSPORT=company` and `NEXT_PUBLIC_COMPANY_HUB_URL` are set,
 * `triggerCompanyChatEvent` dispatches an instant broadcast event to
 * `POST <COMPANY_HUB_URL>/apps/<APP_ID>/events` (matching `lib/embeddedPusher.js`).
 *
 * Fire-and-forget: never blocks or fails API responses if the socket hub is unreachable.
 */

export function isCompanyChatTransportEnabled(): boolean {
  const mode = (process.env.NEXT_PUBLIC_CHAT_TRANSPORT || 'supabase').trim().toLowerCase();
  const hubUrl = (process.env.NEXT_PUBLIC_COMPANY_HUB_URL || '').trim();
  return mode === 'company' && Boolean(hubUrl);
}

export async function triggerCompanyChatEvent(params: {
  projectId: string;
  messageId: number;
  kind?: string;
  action?: 'new_message' | 'message_updated' | 'message_deleted';
}): Promise<void> {
  if (!isCompanyChatTransportEnabled()) return;

  const baseUrl = (process.env.NEXT_PUBLIC_COMPANY_HUB_URL || '').trim().replace(/\/+$/, '');
  const appId = (process.env.PUSHER_APP_ID || 'company-app-id').trim();
  const secret = (process.env.COMPANY_HUB_SECRET || process.env.PUSHER_SECRET || 'company-app-secret-12345').trim();
  const channel = `project:${params.projectId}`;

  try {
    await fetch(`${baseUrl}/apps/${encodeURIComponent(appId)}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-secret': secret,
      },
      body: JSON.stringify({
        name: 'new_message',
        channels: [channel],
        data: {
          project_id: params.projectId,
          message_id: params.messageId,
          kind: params.kind || 'user',
          action: params.action || 'new_message',
        },
      }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[CompanyPusher] Failed to trigger chat event:', err);
    }
  }
}
