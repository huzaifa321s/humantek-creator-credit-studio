'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useUserStore } from '@/lib/userStore';

export const chatUnreadKey = ['chat', 'unread'] as const;

export const chatKeys = {
  all: ['chat'] as const,
  unread: chatUnreadKey,
  messages: (projectId: string | null) => [...chatKeys.all, 'messages', projectId] as const,
};

export interface ChatUnreadResponse {
  counts: Record<string, number>;
  total: number;
}

const EMPTY_UNREAD: ChatUnreadResponse = { counts: {}, total: 0 };

/** Real unread chat counts per project, refreshed every 30s and on window focus. */
export function useChatUnreadQuery() {
  const isSignedIn = useUserStore((s) => Boolean(s.user?.email && s.isSessionVerified));

  const query = useQuery({
    queryKey: chatKeys.unread,
    enabled: isSignedIn,
    queryFn: async (): Promise<ChatUnreadResponse> => {
      const res = await fetch('/api/chat/unread');
      if (res.status === 401 || res.status === 403) return EMPTY_UNREAD;
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as Partial<ChatUnreadResponse>;
      return { counts: data.counts || {}, total: data.total || 0 };
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  return query.data ?? EMPTY_UNREAD;
}

/** Returns a callback that refreshes unread counts (e.g. after marking a chat as read). */
export function useInvalidateChatUnread() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.unread });
  }, [queryClient]);
}

