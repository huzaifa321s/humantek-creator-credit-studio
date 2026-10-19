'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultChatTransport, ChatTransport } from './transport';
import type { ChatAttachment, ChatReplyTo } from '@/types';
import { chatKeys, useInvalidateChatUnread } from '@/lib/queries/chat';
import { projectKeys } from '@/lib/queries/projects';

export interface ProjectChatMessage {
  id: number;
  projectId: string;
  senderId: string | null;
  clientUserId?: string | null;
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
    staffName?: string | null;
    email: string;
    role: string;
    avatarUrl?: string | null;
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

export interface ProjectChatCacheData {
  messages: ProjectChatMessage[];
  lastReadId: number;
}

interface UseProjectChatOptions {
  projectId: string | null;
  transport?: ChatTransport;
  pollIntervalMs?: number;
}

function mergeScopedMessages(
  existing: ProjectChatMessage[],
  incoming: ProjectChatMessage[],
  targetProjectId: string
): ProjectChatMessage[] {
  const map = new Map<number, ProjectChatMessage>();
  for (const m of existing) {
    if (m && m.projectId === targetProjectId) {
      map.set(m.id, m);
    }
  }
  for (const m of incoming) {
    if (m && m.projectId === targetProjectId) {
      map.set(m.id, m);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

export function useProjectChat({
  projectId,
  transport = defaultChatTransport,
  pollIntervalMs = 15_000,
}: UseProjectChatOptions) {
  const isRealProject = Boolean(projectId);
  const queryClient = useQueryClient();
  const invalidateUnread = useInvalidateChatUnread();

  const activeProjectIdRef = useRef<string | null>(projectId);
  useEffect(() => {
    activeProjectIdRef.current = projectId;
  }, [projectId]);

  const queryKey = chatKeys.messages(projectId);

  // Per-thread cached query with automatic incremental (`after_id`) merging,
  // 15s background polling, window focus revalidation, and 0ms thread switching.
  const chatQuery = useQuery<ProjectChatCacheData, Error>({
    queryKey,
    enabled: isRealProject && Boolean(projectId),
    queryFn: async ({ signal }): Promise<ProjectChatCacheData> => {
      if (!projectId) return { messages: [], lastReadId: 0 };

      const existingCache = queryClient.getQueryData<ProjectChatCacheData>(
        chatKeys.messages(projectId)
      );
      const existingMessages = existingCache?.messages ?? [];
      const highestId =
        existingMessages.length > 0 ? existingMessages[existingMessages.length - 1].id : 0;

      const url =
        highestId > 0
          ? `/api/projects/${projectId}/messages?after_id=${highestId}`
          : `/api/projects/${projectId}/messages`;

      const res = await fetch(url, { signal });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Access denied');
        }
        throw new Error('Failed to load messages');
      }

      const data = await res.json();
      const rawMessages: ProjectChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
      const latestCache = queryClient.getQueryData<ProjectChatCacheData>(
        chatKeys.messages(projectId)
      );
      const currentMessages = latestCache?.messages ?? existingMessages;
      const mergedMessages = mergeScopedMessages(currentMessages, rawMessages, projectId);

      const resolvedLastReadId =
        typeof data.lastReadId === 'number'
          ? Math.max(latestCache?.lastReadId ?? 0, data.lastReadId)
          : latestCache?.lastReadId ?? 0;

      return {
        messages: mergedMessages,
        lastReadId: resolvedLastReadId,
      };
    },
    staleTime: 5_000,
    refetchInterval: (query) => {
      if (query.state.error?.message === 'Access denied') return false;
      return pollIntervalMs;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, err) => {
      if (err.message === 'Access denied') return false;
      return failureCount < 1;
    },
  });

  const messages = chatQuery.data?.messages ?? [];
  const lastReadId = chatQuery.data?.lastReadId ?? 0;

  const messagesRef = useRef<ProjectChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Merge newly fetched messages into the per-thread TanStack Query cache
  const mergeMessages = useCallback(
    (newMsgs: ProjectChatMessage[], targetProjectId: string | null) => {
      if (!newMsgs || newMsgs.length === 0 || !targetProjectId) return;
      const validNew = newMsgs.filter((m) => m && m.projectId === targetProjectId);
      if (validNew.length === 0) return;

      queryClient.setQueryData<ProjectChatCacheData>(
        chatKeys.messages(targetProjectId),
        (prev) => ({
          messages: mergeScopedMessages(prev?.messages ?? [], validNew, targetProjectId),
          lastReadId: prev?.lastReadId ?? 0,
        })
      );
    },
    [queryClient]
  );

  // Fetch messages incrementally using after_id and update TanStack Query cache
  const fetchIncremental = useCallback(
    async (currentHighestId?: number, signal?: AbortSignal) => {
      const targetId = projectId;
      if (!isRealProject || !targetId) return;

      const existingCache = queryClient.getQueryData<ProjectChatCacheData>(
        chatKeys.messages(targetId)
      );
      const scopedExisting = (existingCache?.messages ?? []).filter(
        (m) => m.projectId === targetId
      );
      const highest =
        currentHighestId ??
        (scopedExisting.length > 0 ? scopedExisting[scopedExisting.length - 1].id : 0);

      try {
        const url =
          highest > 0
            ? `/api/projects/${targetId}/messages?after_id=${highest}`
            : `/api/projects/${targetId}/messages`;

        const res = await fetch(url, { signal });
        if (activeProjectIdRef.current !== targetId) return;
        if (!res.ok) return;

        const data = await res.json();
        if (activeProjectIdRef.current !== targetId) return;

        queryClient.setQueryData<ProjectChatCacheData>(
          chatKeys.messages(targetId),
          (prev) => {
            const incoming: ProjectChatMessage[] = Array.isArray(data.messages)
              ? data.messages
              : [];
            return {
              messages: mergeScopedMessages(prev?.messages ?? [], incoming, targetId),
              lastReadId:
                typeof data.lastReadId === 'number'
                  ? Math.max(prev?.lastReadId ?? 0, data.lastReadId)
                  : prev?.lastReadId ?? 0,
            };
          }
        );
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to fetch messages:', err);
      }
    },
    [isRealProject, projectId, queryClient]
  );

  // Realtime subscription (Doorbell pattern)
  useEffect(() => {
    const targetId = projectId;
    if (!isRealProject || !targetId) return;

    const controller = new AbortController();

    const unsubscribe = transport.subscribe(
      targetId,
      (evt) => {
        if (activeProjectIdRef.current !== targetId) return;
        if (evt?.projectId && evt.projectId !== targetId) return;
        const scopedExisting = messagesRef.current.filter((m) => m.projectId === targetId);
        const highest = scopedExisting.length > 0 ? scopedExisting[scopedExisting.length - 1].id : 0;
        void fetchIncremental(highest, controller.signal);
        void queryClient.invalidateQueries({ queryKey: chatKeys.unread });
        void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      },
      (err) => {
        console.warn('Realtime channel error on project chat, falling back to polling:', err);
      }
    );

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [isRealProject, projectId, transport, fetchIncremental, queryClient]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      targetId,
      bodyText,
      uploaded,
      clientMessageId,
      replyTo,
      targetClientUserId,
    }: {
      targetId: string;
      bodyText: string;
      uploaded: ChatAttachment[];
      clientMessageId: string;
      replyTo?: ChatReplyTo;
      targetClientUserId?: string | null;
    }) => {
      const res = await fetch(`/api/projects/${targetId}/messages`, {
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
          targetClientUserId: targetClientUserId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send message');
      }

      const data = await res.json();
      return { targetId, message: data.message as ProjectChatMessage | undefined };
    },
    onMutate: async ({ targetId }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(targetId) });
    },
    onSuccess: ({ targetId, message }) => {
      if (message) {
        mergeMessages([message], targetId);
      }
      void queryClient.invalidateQueries({ queryKey: chatKeys.unread });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });

  const sendMessage = useCallback(
    async (
      bodyText: string,
      attachments?: ChatAttachment[],
      existingClientMsgId?: string,
      replyTo?: ChatReplyTo,
      targetClientUserId?: string | null
    ) => {
      const targetId = projectId;
      const uploaded = (attachments || []).filter((a) => a.storagePath);
      if (!isRealProject || !targetId) return;
      if (!bodyText.trim() && uploaded.length === 0) return;

      const clientMessageId =
        existingClientMsgId ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

      await sendMessageMutation.mutateAsync({
        targetId,
        bodyText,
        uploaded,
        clientMessageId,
        replyTo,
        targetClientUserId,
      });
    },
    [isRealProject, projectId, sendMessageMutation]
  );

  // Toggle like mutation
  const toggleLikeMutation = useMutation({
    mutationFn: async ({
      targetId,
      messageId,
    }: {
      targetId: string;
      messageId: number;
      currentUserId?: string;
      currentUserName?: string;
    }) => {
      const res = await fetch(`/api/projects/${targetId}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_like', messageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to toggle like');
      }
      return (await res.json()) as { likes?: ProjectChatMessage['likes'] };
    },
    onMutate: async ({ targetId, messageId, currentUserId, currentUserName }) => {
      const key = chatKeys.messages(targetId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProjectChatCacheData>(key);

      queryClient.setQueryData<ProjectChatCacheData>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) => {
            if (m.id !== messageId) return m;
            const currentLikes = m.likes || [];
            const myId = currentUserId || 'current-user';
            const alreadyLiked = currentLikes.some((l) => l.userId === myId);
            const updatedLikes = alreadyLiked
              ? currentLikes.filter((l) => l.userId !== myId)
              : [
                  ...currentLikes,
                  {
                    userId: myId,
                    userName: currentUserName || 'You',
                    likedAt: new Date().toISOString(),
                  },
                ];
            return { ...m, likes: updatedLikes };
          }),
        };
      });

      return { previous, key };
    },
    onSuccess: (data, { targetId, messageId }) => {
      if (data.likes) {
        queryClient.setQueryData<ProjectChatCacheData>(chatKeys.messages(targetId), (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((m) =>
              m.id === messageId ? { ...m, likes: data.likes } : m
            ),
          };
        });
      }
    },
    onError: (err, _vars, context) => {
      console.error('Failed to toggle like:', err);
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
      void fetchIncremental();
    },
  });

  const toggleLike = useCallback(
    async (messageId: number, currentUserId?: string, currentUserName?: string) => {
      if (!isRealProject || !projectId) return;
      try {
        await toggleLikeMutation.mutateAsync({
          targetId: projectId,
          messageId,
          currentUserId,
          currentUserName,
        });
      } catch {
        // Error already handled in onError
      }
    },
    [isRealProject, projectId, toggleLikeMutation]
  );

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({
      targetId,
      messageId,
      newBody,
    }: {
      targetId: string;
      messageId: number;
      newBody: string;
    }) => {
      const res = await fetch(`/api/projects/${targetId}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', messageId, content: newBody.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to edit message');
      }
      return res.json();
    },
    onMutate: async ({ targetId, messageId, newBody }) => {
      const key = chatKeys.messages(targetId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProjectChatCacheData>(key);

      queryClient.setQueryData<ProjectChatCacheData>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m.id === messageId
              ? { ...m, body: newBody.trim(), isEdited: true, editedAt: new Date().toISOString() }
              : m
          ),
        };
      });

      return { previous, key };
    },
    onError: (err, _vars, context) => {
      console.error('Failed to edit message:', err);
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
      void fetchIncremental();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });

  const editMessage = useCallback(
    async (messageId: number, newBody: string) => {
      if (!isRealProject || !projectId || !newBody.trim()) return;
      await editMessageMutation.mutateAsync({
        targetId: projectId,
        messageId,
        newBody,
      });
    },
    [isRealProject, projectId, editMessageMutation]
  );

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async ({
      targetId,
      messageId,
    }: {
      targetId: string;
      messageId: number;
    }) => {
      const res = await fetch(`/api/projects/${targetId}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', messageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete message');
      }
      return res.json();
    },
    onMutate: async ({ targetId, messageId }) => {
      const key = chatKeys.messages(targetId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProjectChatCacheData>(key);

      queryClient.setQueryData<ProjectChatCacheData>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, body: '', attachments: [] } : m
          ),
        };
      });

      return { previous, key };
    },
    onError: (err, _vars, context) => {
      console.error('Failed to delete message:', err);
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
      void fetchIncremental();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });

  const deleteMessage = useCallback(
    async (messageId: number) => {
      if (!isRealProject || !projectId) return;
      await deleteMessageMutation.mutateAsync({
        targetId: projectId,
        messageId,
      });
    },
    [isRealProject, projectId, deleteMessageMutation]
  );

  // Mark messages as read
  const markAsRead = useCallback(
    async (messageId?: number) => {
      if (!isRealProject || !projectId) return;
      const targetMsgId =
        messageId ??
        (messagesRef.current.length > 0
          ? messagesRef.current[messagesRef.current.length - 1].id
          : 0);

      if (targetMsgId <= lastReadId) return;

      // Optimistically bump lastReadId in the cache
      queryClient.setQueryData<ProjectChatCacheData>(chatKeys.messages(projectId), (old) =>
        old ? { ...old, lastReadId: Math.max(old.lastReadId, targetMsgId) } : old
      );

      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: targetMsgId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (typeof data.lastReadId === 'number') {
            queryClient.setQueryData<ProjectChatCacheData>(chatKeys.messages(projectId), (old) =>
              old ? { ...old, lastReadId: Math.max(old.lastReadId, data.lastReadId) } : old
            );
          }
          invalidateUnread();
        }
      } catch (err) {
        console.error('Failed to mark read state:', err);
      }
    },
    [isRealProject, projectId, lastReadId, queryClient, invalidateUnread]
  );

  const scopedMessages = projectId
    ? messages.filter((m) => m.projectId === projectId)
    : [];
  const unreadCount = scopedMessages.filter((m) => m.id > lastReadId).length;
  const isLoading = Boolean(projectId) && chatQuery.isPending;
  const error = chatQuery.error ? chatQuery.error.message : null;

  return {
    messages: scopedMessages,
    lastReadId,
    unreadCount,
    isLoading,
    isSending: sendMessageMutation.isPending,
    error,
    sendMessage,
    toggleLike,
    editMessage,
    deleteMessage,
    markAsRead,
    refetch: fetchIncremental,
  };
}

