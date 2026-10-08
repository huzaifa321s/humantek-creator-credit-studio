'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { defaultChatTransport, ChatTransport, ChatEvent } from './transport';

export interface ProjectChatMessage {
  id: number;
  projectId: string;
  senderId: string | null;
  kind: 'user' | 'system';
  body: string;
  clientMessageId: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    url: string | null;
    isDeliverable: boolean;
    createdAt: string;
  }>;
}

interface UseProjectChatOptions {
  projectId: string | null;
  transport?: ChatTransport;
  pollIntervalMs?: number;
}

export function useProjectChat({
  projectId,
  transport = defaultChatTransport,
  pollIntervalMs = 15_000,
}: UseProjectChatOptions) {
  const [messages, setMessages] = useState<ProjectChatMessage[]>([]);
  const [lastReadId, setLastReadId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<ProjectChatMessage[]>([]);
  messagesRef.current = messages;

  // Merge newly fetched messages into current state deduplicating by ID and sorting ascending
  const mergeMessages = useCallback((newMsgs: ProjectChatMessage[]) => {
    if (!newMsgs || newMsgs.length === 0) return;
    setMessages((prev) => {
      const map = new Map<number, ProjectChatMessage>();
      for (const m of prev) map.set(m.id, m);
      for (const m of newMsgs) map.set(m.id, m);
      return Array.from(map.values()).sort((a, b) => a.id - b.id);
    });
  }, []);

  // Fetch messages incrementally using after_id with overlap
  const fetchIncremental = useCallback(
    async (currentHighestId?: number) => {
      if (!projectId) return;
      const highest =
        currentHighestId ??
        (messagesRef.current.length > 0
          ? messagesRef.current[messagesRef.current.length - 1].id
          : 0);

      try {
        const url = highest > 0
          ? `/api/projects/${projectId}/messages?after_id=${highest}`
          : `/api/projects/${projectId}/messages`;

        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            setError('Access denied');
          }
          return;
        }

        const data = await res.json();
        if (data.messages) {
          mergeMessages(data.messages);
        }
        if (typeof data.lastReadId === 'number') {
          setLastReadId(data.lastReadId);
        }
      } catch (err: any) {
        console.error('Failed to fetch messages:', err);
      }
    },
    [projectId, mergeMessages]
  );

  // Initial load
  useEffect(() => {
    if (!projectId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/projects/${projectId}/messages`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load messages');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setMessages(data.messages || []);
        setLastReadId(data.lastReadId || 0);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Realtime subscription (Doorbell pattern)
  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = transport.subscribe(
      projectId,
      (event: ChatEvent) => {
        // Doorbell signal: fetch new messages since highest local ID with overlap window
        const highest =
          messagesRef.current.length > 0
            ? messagesRef.current[messagesRef.current.length - 1].id
            : 0;
        fetchIncremental(highest);
      },
      (err) => {
        console.warn('Realtime channel error on project chat, falling back to polling:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [projectId, transport, fetchIncremental]);

  // 15-second polling fallback & online/focus listeners
  useEffect(() => {
    if (!projectId) return;

    const interval = setInterval(() => {
      fetchIncremental();
    }, pollIntervalMs);

    const onFocus = () => fetchIncremental();
    const onOnline = () => fetchIncremental();

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [projectId, pollIntervalMs, fetchIncremental]);

  // Send message
  const sendMessage = useCallback(
    async (bodyText: string, attachments?: any[]) => {
      if (!projectId || !bodyText.trim() || isSending) return;
      setIsSending(true);

      const clientMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: bodyText.trim(),
            clientMessageId,
            attachments: attachments || [],
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to send message');
        }

        const data = await res.json();
        if (data.message) {
          mergeMessages([data.message]);
        }
      } finally {
        setIsSending(false);
      }
    },
    [projectId, isSending, mergeMessages]
  );

  // Mark messages as read
  const markAsRead = useCallback(
    async (messageId?: number) => {
      if (!projectId) return;
      const targetId =
        messageId ??
        (messagesRef.current.length > 0
          ? messagesRef.current[messagesRef.current.length - 1].id
          : 0);

      if (targetId <= lastReadId) return;

      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: targetId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (typeof data.lastReadId === 'number') {
            setLastReadId(data.lastReadId);
          }
        }
      } catch (err) {
        console.error('Failed to mark read state:', err);
      }
    },
    [projectId, lastReadId]
  );

  const unreadCount = messages.filter((m) => m.id > lastReadId).length;

  return {
    messages,
    lastReadId,
    unreadCount,
    isLoading,
    isSending,
    error,
    sendMessage,
    markAsRead,
    refetch: fetchIncremental,
  };
}
