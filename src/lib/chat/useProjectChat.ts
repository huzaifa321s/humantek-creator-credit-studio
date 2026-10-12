'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { defaultChatTransport, ChatTransport } from './transport';
import type { ChatAttachment, ChatReplyTo } from '@/types';
import { useInvalidateChatUnread } from '@/lib/queries/chat';

export interface ProjectChatMessage {
  id: number;
  projectId: string;
  senderId: string | null;
  kind: 'user' | 'system';
  body: string;
  clientMessageId: string | null;
  createdAt: string;
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
  const isRealProject = Boolean(projectId);
  const invalidateUnread = useInvalidateChatUnread();
  const [messages, setMessages] = useState<ProjectChatMessage[]>([]);
  const [lastReadId, setLastReadId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(projectId));
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setMessages([]);
    setLastReadId(0);
    setIsLoading(Boolean(projectId));
    setError(null);
  }

  const messagesRef = useRef<ProjectChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
      if (!isRealProject) return;
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
      } catch (err: unknown) {
        console.error('Failed to fetch messages:', err);
      }
    },
    [isRealProject, projectId, mergeMessages]
  );

  // Initial load
  useEffect(() => {
    if (!isRealProject) return;

    let isMounted = true;

    fetch(`/api/projects/${projectId}/messages`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError('Access denied');
            return null;
          }
          throw new Error('Failed to load messages');
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted || !data) {
          setIsLoading(false);
          return;
        }
        setMessages(data.messages || []);
        setLastReadId(data.lastReadId || 0);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load messages');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isRealProject, projectId]);

  // Realtime subscription (Doorbell pattern)
  useEffect(() => {
    if (!isRealProject) return;

    const unsubscribe = transport.subscribe(
      projectId!,
      () => {
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
  }, [isRealProject, projectId, transport, fetchIncremental]);

  // 15-second polling fallback & online/focus listeners
  useEffect(() => {
    if (!isRealProject || error === 'Access denied') return;

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
  }, [isRealProject, projectId, pollIntervalMs, fetchIncremental, error]);

  // Send message
  const sendMessage = useCallback(
    async (
      bodyText: string,
      attachments?: ChatAttachment[],
      existingClientMsgId?: string,
      replyTo?: ChatReplyTo
    ) => {
      const uploaded = (attachments || []).filter((a) => a.storagePath);
      if (!isRealProject) return;
      if (!bodyText.trim() && uploaded.length === 0) return;
      setIsSending(true);

      const clientMessageId =
        existingClientMsgId ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: bodyText.trim(),
            clientMessageId,
            attachments: uploaded.map((a) => ({
              storagePath: a.storagePath,
              fileName: a.name,
              fileSize: a.fileSize,
              mimeType: a.mimeType,
            })),
            replyTo: replyTo || undefined,
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
    [isRealProject, projectId, mergeMessages]
  );

  // Toggle like on message
  const toggleLike = useCallback(
    async (messageId: number, currentUserId?: string, currentUserName?: string) => {
      if (!isRealProject) return;

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const currentLikes = m.likes || [];
          const myId = currentUserId || 'current-user';
          const alreadyLiked = currentLikes.some((l) => l.userId === myId);
          const updatedLikes = alreadyLiked
            ? currentLikes.filter((l) => l.userId !== myId)
            : [...currentLikes, { userId: myId, userName: currentUserName || 'You', likedAt: new Date().toISOString() }];
          return { ...m, likes: updatedLikes };
        })
      );

      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle_like', messageId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to toggle like');
        }
        const data = await res.json();
        if (data.likes) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, likes: data.likes } : m))
          );
        }
      } catch (err) {
        console.error('Failed to toggle like:', err);
        fetchIncremental();
      }
    },
    [isRealProject, projectId, fetchIncremental]
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId: number, newBody: string) => {
      if (!isRealProject || !newBody.trim()) return;

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, body: newBody.trim(), isEdited: true, editedAt: new Date().toISOString() } : m
        )
      );

      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', messageId, content: newBody.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to edit message');
        }
      } catch (err: unknown) {
        console.error('Failed to edit message:', err);
        fetchIncremental();
        throw err;
      }
    },
    [isRealProject, projectId, fetchIncremental]
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId: number) => {
      if (!isRealProject) return;

      // Optimistic delete
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isDeleted: true, body: '', attachments: [] }
            : m
        )
      );

      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', messageId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete message');
        }
      } catch (err: unknown) {
        console.error('Failed to delete message:', err);
        fetchIncremental();
        throw err;
      }
    },
    [isRealProject, projectId, fetchIncremental]
  );

  // Mark messages as read
  const markAsRead = useCallback(
    async (messageId?: number) => {
      if (!isRealProject) return;
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
          invalidateUnread();
        }
      } catch (err) {
        console.error('Failed to mark read state:', err);
      }
    },
    [isRealProject, projectId, lastReadId, invalidateUnread]
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
    toggleLike,
    editMessage,
    deleteMessage,
    markAsRead,
    refetch: fetchIncremental,
  };
}
