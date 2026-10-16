'use client';

import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
  ChatMessage as BaseChatMessage,
  ChatAttachment,
  ChatOrderCard,
  ChatReaction,
  ChatAudioNote,
  ChatLike,
  ChatReplyTo,
} from '@/types';
import { useChatUnreadQuery } from '@/lib/queries/chat';

export interface ChatMessage extends BaseChatMessage {
  senderId?: string;
  staffName?: string | null;
  clientUserId?: string | null;
}

export type { ChatAttachment, ChatOrderCard, ChatReaction, ChatAudioNote, ChatLike, ChatReplyTo };

export interface ProjectMeta {
  id: string;
  projectCode: string;
  packageName: string;
  channelName?: string;
  clientName: string;
  status: string;
  price?: number;
  credits?: number;
}

/** Global Studio Support chat channel available to all clients. */
export const GLOBAL_CHAT_ID = 'global';

export const GLOBAL_META: ProjectMeta = {
  id: GLOBAL_CHAT_ID,
  projectCode: 'INQUIRY',
  packageName: 'Ask the Studio Team',
  clientName: 'Studio Team',
  status: 'active',
};

const STORAGE_KEY = 'humantek_project_chat_v7';
/** Older keys that held seeded demo conversations. Removed on first load. */
const LEGACY_STORAGE_KEYS = [
  'humantek_project_chat_v6',
  'humantek_client_chat_v2',
  'humantek_client_chat_messages_v1',
];

interface ChatState {
  activeProjectId: string;
  /**
   * Local outbox only: messages that are still sending or failed to send.
   * Confirmed messages live on the server and are removed from here.
   */
  projectMessages: Record<string, ChatMessage[]>;
  isOpen: boolean;

  // Per-project draft persistence (Auto-persisted to localStorage)
  drafts: Record<string, string>;
  setDraft: (projectId: string, text: string) => void;
  clearDraft: (projectId: string) => void;

  // Floating unread counter when scrolled up
  unreadBelowScroll: Record<string, number>;
  incrementUnreadBelowScroll: (projectId: string) => void;
  clearUnreadBelowScroll: (projectId: string) => void;

  // Idempotency & Outbox Actions
  inFlight: Record<string, boolean>;
  queueMessage: (
    projectId: string,
    text: string,
    options?: {
      attachments?: ChatAttachment[];
      clientMsgId?: string;
      replyTo?: ChatReplyTo;
      senderName?: string;
      clientUserId?: string | null;
    }
  ) => string | undefined;
  removeMessage: (projectId: string, clientMessageId: string) => void;
  markMessageFailed: (projectId: string, clientMessageId: string, errorReason?: string) => void;

  setActiveProjectId: (projectId: string) => void;
  setIsOpen: (open: boolean, projectId?: string) => void;
  registerProject: (project: ProjectMeta | Record<string, unknown>) => void;
}

const nowLabel = () =>
  `Today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      activeProjectId: GLOBAL_CHAT_ID,
      projectMessages: {},
      isOpen: false,
      drafts: {},
      unreadBelowScroll: {},
      inFlight: {},

      setDraft: (projectId, text) => {
        set((s) => {
          if ((s.drafts[projectId] || '') === text) return s;
          return { drafts: { ...s.drafts, [projectId]: text } };
        });
      },

      clearDraft: (projectId) => {
        set((s) => {
          if (!s.drafts[projectId]) return s;
          const next = { ...s.drafts };
          delete next[projectId];
          return { drafts: next };
        });
      },

      incrementUnreadBelowScroll: (projectId) => {
        set((s) => ({
          unreadBelowScroll: {
            ...s.unreadBelowScroll,
            [projectId]: (s.unreadBelowScroll[projectId] || 0) + 1,
          },
        }));
      },

      clearUnreadBelowScroll: (projectId) => {
        set((s) => {
          if (!s.unreadBelowScroll[projectId]) return s;
          return { unreadBelowScroll: { ...s.unreadBelowScroll, [projectId]: 0 } };
        });
      },

      queueMessage: (projectId, text, options = {}) => {
        const { attachments, replyTo, senderName, clientUserId } = options;
        if (!text.trim() && (!attachments || attachments.length === 0)) return undefined;

        const clientMessageId = options.clientMsgId || newId();

        // Single-flight lock: prevent duplicate execution from double clicks/taps
        if (get().inFlight[clientMessageId]) return undefined;

        const optimisticMsg: ChatMessage = {
          id: clientMessageId,
          clientMessageId,
          projectId,
          clientUserId: clientUserId ?? null,
          sender: 'client',
          senderName: senderName || 'You',
          content: text.trim(),
          timestamp: nowLabel(),
          createdAtRaw: new Date().toISOString(),
          attachments,
          replyTo: replyTo || undefined,
          likes: [],
          isEdited: false,
          isDeleted: false,
          isRead: true,
          status: 'sending',
          errorReason: undefined,
        };

        set((s) => {
          const list = s.projectMessages[projectId] || [];
          const exists = list.some((m) => m.clientMessageId === clientMessageId);
          return {
            inFlight: { ...s.inFlight, [clientMessageId]: true },
            drafts: { ...s.drafts, [projectId]: '' },
            projectMessages: {
              ...s.projectMessages,
              [projectId]: exists
                ? list.map((m) => (m.clientMessageId === clientMessageId ? optimisticMsg : m))
                : [...list, optimisticMsg],
            },
          };
        });

        return clientMessageId;
      },

      removeMessage: (projectId, clientMessageId) => {
        set((s) => {
          const nextInFlight = { ...s.inFlight };
          delete nextInFlight[clientMessageId];
          return {
            inFlight: nextInFlight,
            projectMessages: {
              ...s.projectMessages,
              [projectId]: (s.projectMessages[projectId] || []).filter(
                (m) => m.clientMessageId !== clientMessageId
              ),
            },
          };
        });
      },

      markMessageFailed: (projectId, clientMessageId, errorReason = 'Failed to send. Tap to retry.') => {
        set((s) => {
          const nextInFlight = { ...s.inFlight };
          delete nextInFlight[clientMessageId];
          return {
            inFlight: nextInFlight,
            projectMessages: {
              ...s.projectMessages,
              [projectId]: (s.projectMessages[projectId] || []).map((m) =>
                m.clientMessageId === clientMessageId ? { ...m, status: 'failed', errorReason } : m
              ),
            },
          };
        });
      },

      setActiveProjectId: (projectId) => {
        set((s) => (s.activeProjectId === projectId ? s : { activeProjectId: projectId }));
      },

      setIsOpen: (open, projectId) => {
        set((s) => {
          const targetId = projectId || s.activeProjectId;
          if (s.isOpen === open && s.activeProjectId === targetId) return s;
          return { isOpen: open, activeProjectId: targetId };
        });
      },

      registerProject: (project) => {
        const id =
          typeof project === 'object' && project !== null && 'id' in project && project.id != null
            ? String(project.id)
            : undefined;
        if (id) {
          set({ activeProjectId: id });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        drafts: s.drafts,
      }),
      version: 8,
      skipHydration: true,
    }
  )
);

function removeLegacyChatStorage() {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable (private mode etc.): nothing to clean up
  }
}

let hydrationStarted = false;

const EMPTY_MESSAGES: ChatMessage[] = [];

export function useStudioChat(scopedProjectId?: string) {
  useEffect(() => {
    if (!hydrationStarted) {
      hydrationStarted = true;
      removeLegacyChatStorage();
      void useChatStore.persist.rehydrate();
    }
  }, []);

  const {
    activeProjectId,
    projectMessages,
    isOpen,
    drafts,
    unreadBelowScroll,
    inFlight,
    setActiveProjectId,
    setIsOpen,
    queueMessage,
    removeMessage,
    markMessageFailed,
    setDraft,
    clearDraft,
    incrementUnreadBelowScroll,
    clearUnreadBelowScroll,
  } = useChatStore(
    useShallow((s) => ({
      activeProjectId: s.activeProjectId,
      projectMessages: s.projectMessages,
      isOpen: s.isOpen,
      drafts: s.drafts,
      unreadBelowScroll: s.unreadBelowScroll,
      inFlight: s.inFlight,
      setActiveProjectId: s.setActiveProjectId,
      setIsOpen: s.setIsOpen,
      queueMessage: s.queueMessage,
      removeMessage: s.removeMessage,
      markMessageFailed: s.markMessageFailed,
      setDraft: s.setDraft,
      clearDraft: s.clearDraft,
      incrementUnreadBelowScroll: s.incrementUnreadBelowScroll,
      clearUnreadBelowScroll: s.clearUnreadBelowScroll,
    }))
  );

  // Real unread counts from the server (messages from others after your last read message)
  const { counts: unreadCounts, total: totalUnreadCount } = useChatUnreadQuery();

  const effectiveProjectId = scopedProjectId || activeProjectId || GLOBAL_CHAT_ID;
  const isGlobal = effectiveProjectId === GLOBAL_CHAT_ID;
  const outbox = projectMessages[effectiveProjectId] || EMPTY_MESSAGES;

  const handleQueueMessage = useCallback(
    (
      text: string,
      options?: {
        attachments?: ChatAttachment[];
        clientMsgId?: string;
        replyTo?: ChatReplyTo;
        senderName?: string;
        clientUserId?: string | null;
      }
    ) => queueMessage(effectiveProjectId, text, options),
    [queueMessage, effectiveProjectId]
  );

  const handleRemoveMessage = useCallback(
    (clientMessageId: string) => removeMessage(effectiveProjectId, clientMessageId),
    [removeMessage, effectiveProjectId]
  );

  const handleMarkMessageFailed = useCallback(
    (clientMessageId: string, errorReason?: string) =>
      markMessageFailed(effectiveProjectId, clientMessageId, errorReason),
    [markMessageFailed, effectiveProjectId]
  );

  const handleSetDraft = useCallback(
    (text: string) => setDraft(effectiveProjectId, text),
    [setDraft, effectiveProjectId]
  );

  const handleClearDraft = useCallback(
    () => clearDraft(effectiveProjectId),
    [clearDraft, effectiveProjectId]
  );

  const handleIncrementUnreadBelowScroll = useCallback(
    () => incrementUnreadBelowScroll(effectiveProjectId),
    [incrementUnreadBelowScroll, effectiveProjectId]
  );

  const handleClearUnreadBelowScroll = useCallback(
    () => clearUnreadBelowScroll(effectiveProjectId),
    [clearUnreadBelowScroll, effectiveProjectId]
  );

  return {
    projectId: effectiveProjectId,
    isGlobal,
    /** Pending / failed messages for the active project (not yet confirmed by the server). */
    outbox,
    isOpen,
    unreadCount: unreadCounts[effectiveProjectId] || 0,
    totalUnreadCount,
    unreadCounts,
    draft: drafts[effectiveProjectId] || '',
    unreadBelowScroll: unreadBelowScroll[effectiveProjectId] || 0,
    inFlight,
    setActiveProjectId,
    setIsOpen,
    setDraft: handleSetDraft,
    clearDraft: handleClearDraft,
    incrementUnreadBelowScroll: handleIncrementUnreadBelowScroll,
    clearUnreadBelowScroll: handleClearUnreadBelowScroll,
    queueMessage: handleQueueMessage,
    removeMessage: handleRemoveMessage,
    markMessageFailed: handleMarkMessageFailed,
  };
}
