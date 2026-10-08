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

export const defaultChatTransport: ChatTransport = new SupabaseRealtimeTransport();
