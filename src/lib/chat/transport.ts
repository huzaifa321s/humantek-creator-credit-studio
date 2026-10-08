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
    onError?: (error: any) => void
  ): () => void;
}

/**
 * Supabase Realtime Broadcast implementation of ChatTransport.
 * Uses private broadcast channels (project:<id>) verified against database RLS.
 */
export class SupabaseRealtimeTransport implements ChatTransport {
  subscribe(
    projectId: string,
    onEvent: (event: ChatEvent) => void,
    onError?: (error: any) => void
  ): () => void {
    const supabase = createClient();
    const topic = `project:${projectId}`;
    let isCancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
      } catch (err) {
        console.warn('Could not set realtime auth token:', err);
      }

      if (isCancelled) return;

      channel = supabase.channel(topic, {
        config: {
          broadcast: {
            self: false,
          },
          private: true,
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
        .subscribe((status, err) => {
          if (err || status === 'CHANNEL_ERROR') {
            if (onError) onError(err || new Error(`Channel error on ${topic}`));
          }
        });
    };

    void setup();

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }
}

export const defaultChatTransport: ChatTransport = new SupabaseRealtimeTransport();
