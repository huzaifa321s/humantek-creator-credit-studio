import { createClient } from '@/lib/supabase/client';

export interface ChatEvent {
  projectId: string;
  messageId: number;
  kind?: string;
}

export interface ChatTransport {
  subscribe(
    projectId: string,
    onEvent: (event: ChatEvent) => void,
    onError?: (error: unknown) => void
  ): () => void;
}

/**
 * 1. Company Server Pusher Protocol v7 WebSocket Transport (Zero-Dependency).
 * Connects directly to your 24/7 Company Server's `embeddedPusher` WebSocket endpoint
 * (`/app/<APP_KEY>?protocol=7&client=js&version=7.0.0`), eliminating all Supabase
 * Realtime connection and message quotas when `NEXT_PUBLIC_CHAT_TRANSPORT=company`.
 */
export class CompanyPusherTransport implements ChatTransport {
  subscribe(
    projectId: string,
    onEvent: (event: ChatEvent) => void,
    onError?: (error: unknown) => void
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    const topic = `project:${projectId}`;
    const rawHubUrl = (process.env.NEXT_PUBLIC_COMPANY_HUB_URL || '').trim().replace(/\/+$/, '');
    const appKey = (process.env.NEXT_PUBLIC_PUSHER_KEY || 'company-app-key').trim();

    if (!rawHubUrl) {
      return () => {};
    }

    const wsBase = rawHubUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
    const wsUrl = `${wsBase}/app/${encodeURIComponent(appKey)}?protocol=7&client=js&version=7.0.0`;

    let isCancelled = false;
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (isCancelled) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        if (!isCancelled && onError) onError(err);
        return;
      }

      ws.onopen = () => {
        if (isCancelled || !ws) {
          ws?.close();
          return;
        }
        // Keep connection alive with Pusher v7 ping every 45s
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
          }
        }, 45_000);
      };

      ws.onmessage = (event) => {
        if (isCancelled || !ws) return;
        try {
          const msg = JSON.parse(String(event.data));
          const eventName: string = msg.event || '';
          let payload = msg.data;
          if (typeof payload === 'string' && payload.startsWith('{')) {
            try {
              payload = JSON.parse(payload);
            } catch {}
          }

          // Handshake complete -> subscribe to project channel
          if (eventName === 'pusher:connection_established') {
            ws.send(
              JSON.stringify({
                event: 'pusher:subscribe',
                data: { channel: topic },
              })
            );
            return;
          }

          // Broadcast event received on channel
          if (
            (eventName === 'new_message' || eventName === 'client-new_message') &&
            (!msg.channel || msg.channel === topic)
          ) {
            const pId = payload?.project_id || payload?.projectId || projectId;
            const mId = Number(payload?.message_id ?? payload?.messageId ?? 0);
            onEvent({
              projectId: pId,
              messageId: mId,
              kind: payload?.kind,
            });
          }
        } catch {}
      };

      ws.onerror = (err) => {
        if (!isCancelled && onError) onError(err);
      };

      ws.onclose = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!isCancelled) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    // Defer socket creation by 15ms so React Strict Mode's immediate dev unmount
    // cancels the timer cleanly without opening & aborting a throwaway socket.
    connectTimer = setTimeout(connect, 15);

    return () => {
      isCancelled = true;
      if (connectTimer) clearTimeout(connectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          // Detach handlers before closing so intentional cleanup never triggers onerror
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                event: 'pusher:unsubscribe',
                data: { channel: topic },
              })
            );
            ws.close();
          }
        } catch {}
        ws = null;
      }
    };
  }
}

/**
 * 2. Supabase Realtime Broadcast implementation of ChatTransport.
 * Uses broadcast and postgres_changes channels (project:<id>).
 */
export class SupabaseRealtimeTransport implements ChatTransport {
  subscribe(
    projectId: string,
    onEvent: (event: ChatEvent) => void,
    onError?: (error: unknown) => void
  ): () => void {
    const supabase = createClient();
    const topic = `project:${projectId}`;
    let isCancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;

    const setup = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }

        // Keep Realtime token synchronized on token refresh or sign-in state changes
        const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession?.access_token && !isCancelled) {
            await supabase.realtime.setAuth(newSession.access_token);
          }
        });
        authListener = listener;
      } catch (err) {
        console.warn('Could not set realtime auth token:', err);
      }

      if (isCancelled) return;

      channel = supabase.channel(topic, {
        config: {
          broadcast: {
            self: false,
          },
          private: false,
        },
      });

      channel
        .on('broadcast', { event: 'new_message' }, ({ payload }) => {
          if (payload && payload.project_id === projectId) {
            onEvent({
              projectId: payload.project_id,
              messageId: Number(payload.message_id),
              kind: payload.kind,
            });
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'project_messages',
            filter: `project_id=eq.${projectId}`,
          },
          (payload) => {
            const row = (payload.new || payload.old) as { id?: number; project_id?: string; kind?: string } | null;
            if (row && row.id) {
              onEvent({
                projectId: row.project_id || projectId,
                messageId: Number(row.id),
                kind: row.kind,
              });
            }
          }
        )
        .subscribe((status, err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Realtime Chat] Channel ${topic} status:`, status);
          }
          if (err || status === 'CHANNEL_ERROR') {
            if (onError) onError(err || new Error(`Channel error on ${topic}`));
          }
        });
    };

    void setup();

    return () => {
      isCancelled = true;
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }
}

export function isCompanyTransportEnabled(): boolean {
  const mode = (process.env.NEXT_PUBLIC_CHAT_TRANSPORT || 'supabase').trim().toLowerCase();
  const hubUrl = (process.env.NEXT_PUBLIC_COMPANY_HUB_URL || '').trim();
  return mode === 'company' && Boolean(hubUrl);
}

/**
 * Dual-mode transport selector:
 * Uses `CompanyPusherTransport` when `NEXT_PUBLIC_CHAT_TRANSPORT=company` and
 * `NEXT_PUBLIC_COMPANY_HUB_URL` is configured; otherwise defaults to `SupabaseRealtimeTransport`.
 */
function createDefaultChatTransport(): ChatTransport {
  if (isCompanyTransportEnabled()) {
    return new CompanyPusherTransport();
  }
  return new SupabaseRealtimeTransport();
}

export const defaultChatTransport: ChatTransport = createDefaultChatTransport();
