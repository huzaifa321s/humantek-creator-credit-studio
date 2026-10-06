'use client';

import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { ChatMessage, ChatAttachment, ChatOrderCard, ChatReaction, ChatAudioNote } from '@/types';

export type { ChatMessage, ChatAttachment, ChatOrderCard, ChatReaction, ChatAudioNote };

export interface SalesAgentProfile {
  name: string;
  role: string;
  department: string;
  status: 'online' | 'busy' | 'away';
  avatarInitials: string;
  responseTime: string;
  verified: boolean;
}

export const DEFAULT_AGENT: SalesAgentProfile = {
  name: 'Sarah Miller',
  role: 'Senior Creative Producer & Account Lead',
  department: 'Humantek Creative Operations',
  status: 'online',
  avatarInitials: 'SM',
  responseTime: 'Replies in ~2 mins',
  verified: true,
};

// Realistic mock moodboard reference data
export const SAMPLE_REFERENCES: ChatAttachment[] = [
  {
    id: 'ref-1',
    name: 'cyberpunk-neon-moodboard.png',
    url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop',
    size: '2.4 MB',
    type: 'image',
    previewUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'ref-2',
    name: 'chibi-anime-style-guide.png',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
    size: '1.8 MB',
    type: 'image',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'ref-3',
    name: 'minimalist-vector-overlays.png',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
    size: '3.1 MB',
    type: 'image',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
  },
];

export interface ProjectMeta {
  id: string;
  projectCode: string;
  packageName: string;
  clientName: string;
  status: string;
  price?: number;
  credits?: number;
}

export const DEFAULT_DEMO_PROJECT: ProjectMeta = {
  id: 'proj-demo-1',
  projectCode: 'HT-9428-FORGE',
  packageName: 'Creator Forge',
  clientName: 'Kira Streams',
  status: 'in_production',
  price: 1500,
  credits: 660,
};

export const GLOBAL_CHAT_ID = 'global';

export const GLOBAL_META: ProjectMeta = {
  id: GLOBAL_CHAT_ID,
  projectCode: 'GLOBAL',
  packageName: 'General Studio Consultation',
  clientName: 'Creator Client',
  status: 'active',
};

export function createInitialGlobalMessages(): ChatMessage[] {
  return [
    {
      id: 'msg-global-welcome-1',
      projectId: GLOBAL_CHAT_ID,
      sender: 'agent',
      senderName: 'Sarah Miller',
      senderRole: 'Lead Producer & Account Lead',
      content: `Welcome to Humantek Studio! This is your general conversation with me.\n\nAsk about packages, credits, timelines, or new project ideas anytime.`,
      timestamp: 'Today at 09:15 AM',
      isRead: true,
      reactions: [
        { emoji: '👋', count: 1, reacted: true },
      ],
    },
  ];
}

export function buildGlobalAgentReply(clientText: string): string {
  const lower = clientText.toLowerCase();
  if (lower.includes('credit') || lower.includes('rollover') || lower.includes('wallet') || lower.includes('balance')) {
    return `Unused credits automatically roll over for 12 months with any active studio tier. You can also redeem credits or add top-ups anytime from your Studio Wallet!`;
  }
  if (lower.includes('package') || lower.includes('pricing') || lower.includes('cost') || lower.includes('tier') || lower.includes('price')) {
    return `We offer Starter (150 CR / $450), Creator Forge (660 CR / $1,500), and Signature Collective (1,400 CR / $3,200). Each tier includes dedicated senior art direction, motion design, and milestone deliverables!`;
  }
  if (lower.includes('turnaround') || lower.includes('time') || lower.includes('fast') || lower.includes('urgent') || lower.includes('deadline')) {
    return `Standard turnaround is 48–72 hours for initial concepts once your brief is submitted. For urgent twitch/stream launches, we can prioritize express queues!`;
  }
  if (lower.includes('custom') || lower.includes('3d') || lower.includes('enterprise') || lower.includes('quote')) {
    return `Yes! We support custom 3D character modeling, Unreal Engine vtuber avatars, and full brand overhauls. Let me know what you have in mind and I can draft a custom scope!`;
  }
  return `Thanks for your message! I've noted this down. If this is for a new project brief, you can click "+ New Brief" anytime to launch a dedicated workspace, or let me know how else I can help!`;
}

export function createInitialProjectMessages(project: ProjectMeta): ChatMessage[] {
  if (project.id === 'proj-demo-1' || project.projectCode === 'HT-9428-FORGE') {
    return [
      {
        id: `msg-${project.id}-2`,
        projectId: project.id,
        sender: 'agent',
        senderName: 'Sarah Miller',
        senderRole: 'Senior Creative Producer',
        content: `Hi ${project.clientName}! Welcome to your dedicated project workspace for ${project.packageName} (${project.projectCode}). I'm Sarah, your assigned creative producer. Feel free to upload references, ask about milestones, or discuss revisions directly in this project thread.`,
        timestamp: 'Yesterday at 10:15 AM',
        isRead: true,
      },
      {
        id: `msg-${project.id}-3`,
        projectId: project.id,
        sender: 'client',
        senderName: project.clientName || 'You (Creator)',
        content: `Hi Sarah! We are aiming for a high-contrast Cyberpunk aesthetic with animated stingers and custom overlays. Here is our current visual moodboard:`,
        timestamp: 'Yesterday at 10:18 AM',
        attachments: [SAMPLE_REFERENCES[0]],
        reactions: [
          { emoji: '👍', count: 1, reacted: true },
          { emoji: '🔥', count: 2, reacted: false },
        ],
        isRead: true,
      },
      {
        id: `msg-${project.id}-4`,
        projectId: project.id,
        sender: 'agent',
        senderName: 'Sarah Miller',
        senderRole: 'Senior Creative Producer',
        content: `This neon palette is fantastic! The magenta/cyan color grading pairs perfectly with our Elite 3D stinger workflow. Our production artists have begun Milestone 1 thumbnails.`,
        timestamp: 'Today at 09:30 AM',
        reactions: [
          { emoji: '🚀', count: 1, reacted: true },
        ],
        audioNote: {
          duration: '0:28',
        },
        isRead: false,
      },
    ];
  }

  return [
    {
      id: `msg-${project.id}-2`,
      projectId: project.id,
      sender: 'agent',
      senderName: 'Sarah Miller',
      senderRole: 'Senior Creative Producer',
      content: `Hi ${project.clientName || 'there'}! I'm Sarah, your lead creative producer for ${project.packageName} (${project.projectCode}). Our art directors are reviewing your creative brief and will share Milestone 1 concept updates here.`,
      timestamp: 'Today at 10:02 AM',
      reactions: [
        { emoji: '👋', count: 1, reacted: true },
      ],
      isRead: true,
    },
  ];
}

const STORAGE_KEY = 'humantek_project_chat_v5';
const LEGACY_STORAGE_KEY_V2 = 'humantek_client_chat_v2';
const LEGACY_STORAGE_KEY_V1 = 'humantek_client_chat_messages_v1';

interface ChatState {
  activeProjectId: string;
  projectMessages: Record<string, ChatMessage[]>;
  projectMeta: Record<string, ProjectMeta>;
  isOpen: boolean;
  isTyping: Record<string, boolean>;

  setActiveProjectId: (projectId: string) => void;
  setIsOpen: (open: boolean, projectId?: string) => void;
  markProjectAsRead: (projectId: string) => void;
  sendMessage: (text: string, attachments?: ChatAttachment[], targetProjectId?: string) => void;
  toggleReaction: (projectId: string, messageId: string, emoji: string) => void;
  registerProject: (project: ProjectMeta) => void;
}

const nowLabel = () =>
  `Today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

function buildProjectAgentReply(
  clientText: string,
  meta?: ProjectMeta,
  attachments?: ChatAttachment[]
): string {
  const lower = clientText.toLowerCase();
  const code = meta?.projectCode || 'your project';
  const pkg = meta?.packageName || 'active package';

  if (attachments && attachments.length > 0) {
    return `Received the reference file (${attachments[0].name}) for ${code}! I've pinned this directly into the production board for this project.`;
  }
  if (lower.includes('status') || lower.includes('queue') || lower.includes('update')) {
    return `Status for ${code} (${pkg}): Currently in production queue. Our lead designer will submit Milestone 1 thumbnails here for review within 48 hours.`;
  }
  if (lower.includes('milestone') || lower.includes('deliverable') || lower.includes('stage')) {
    return `Deliverables for ${code} follow our 6-stage milestone tracker. Once drafts are approved in this thread, final 4K/60fps render exports will be linked right here.`;
  }
  if (lower.includes('revision') || lower.includes('change') || lower.includes('edit')) {
    return `All packages include dedicated review rounds! You can mark revisions directly on the concept frames in this chat.`;
  }
  if (lower.includes('credit') || lower.includes('balance') || lower.includes('cost')) {
    return `Credits allocated to ${code} are protected. Any unused balance remains safely in your studio wallet with 12-month rollover!`;
  }
  return `Thanks for the update regarding ${code}! I've logged this in the production brief for the art team.`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      activeProjectId: GLOBAL_CHAT_ID,
      projectMessages: {
        [GLOBAL_CHAT_ID]: createInitialGlobalMessages(),
        [DEFAULT_DEMO_PROJECT.id]: createInitialProjectMessages(DEFAULT_DEMO_PROJECT),
      },
      projectMeta: {
        [GLOBAL_CHAT_ID]: GLOBAL_META,
        [DEFAULT_DEMO_PROJECT.id]: DEFAULT_DEMO_PROJECT,
      },
      isOpen: false,
      isTyping: {},

      setActiveProjectId: (projectId) => {
        set((s) => {
          if (s.activeProjectId === projectId) {
            if (!s.isOpen) return s;
            const msgs = s.projectMessages[projectId] || [];
            if (!msgs.some((m) => !m.isRead)) return s;
          }
          return {
            activeProjectId: projectId,
            // When switching, auto mark that project as read if open
            projectMessages: s.isOpen
              ? {
                  ...s.projectMessages,
                  [projectId]: (s.projectMessages[projectId] || []).map((m) =>
                    m.isRead ? m : { ...m, isRead: true }
                  ),
                }
              : s.projectMessages,
          };
        });
      },

      setIsOpen: (open, projectId) => {
        set((s) => {
          const targetId = projectId || s.activeProjectId;
          const currentMsgs = s.projectMessages[targetId] || [];
          const hasUnread = currentMsgs.some((m) => !m.isRead);
          if (s.isOpen === open && s.activeProjectId === targetId && !hasUnread) {
            return s;
          }
          return {
            isOpen: open,
            activeProjectId: targetId,
            projectMessages: open && hasUnread
              ? {
                  ...s.projectMessages,
                  [targetId]: currentMsgs.map((m) => (m.isRead ? m : { ...m, isRead: true })),
                }
              : s.projectMessages,
          };
        });
      },

      markProjectAsRead: (projectId) => {
        set((s) => {
          const msgs = s.projectMessages[projectId];
          if (!msgs) return s;
          const hasUnread = msgs.some((m) => !m.isRead);
          if (!hasUnread) return s; // Guard against infinite render loop
          return {
            projectMessages: {
              ...s.projectMessages,
              [projectId]: msgs.map((m) => (m.isRead ? m : { ...m, isRead: true })),
            },
          };
        });
      },

      registerProject: (project) => {
        set((s) => {
          const existingMeta = s.projectMeta[project.id];
          const existingMsgs = s.projectMessages[project.id];
          if (
            existingMeta &&
            existingMsgs &&
            existingMeta.projectCode === project.projectCode &&
            existingMeta.packageName === project.packageName &&
            existingMeta.clientName === project.clientName &&
            existingMeta.status === project.status &&
            existingMeta.price === project.price &&
            existingMeta.credits === project.credits
          ) {
            return s; // No-op if metadata already registered and identical
          }
          return {
            projectMeta: {
              ...s.projectMeta,
              [project.id]: project,
            },
            projectMessages: existingMsgs
              ? s.projectMessages
              : {
                  ...s.projectMessages,
                  [project.id]: createInitialProjectMessages(project),
                },
          };
        });
      },

      sendMessage: (text, attachments, targetProjectId) => {
        if (!text.trim() && (!attachments || attachments.length === 0)) return;

        const currentTargetId = targetProjectId || get().activeProjectId;
        const isGlobal = currentTargetId === GLOBAL_CHAT_ID;
        const meta = isGlobal ? GLOBAL_META : (get().projectMeta[currentTargetId] || DEFAULT_DEMO_PROJECT);

        const newMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          projectId: currentTargetId,
          sender: 'client',
          senderName: isGlobal ? 'You (Creator)' : (meta.clientName || 'You (Creator)'),
          content: text.trim(),
          timestamp: nowLabel(),
          attachments,
          isRead: true,
        };

        set((s) => ({
          projectMessages: {
            ...s.projectMessages,
            [currentTargetId]: [...(s.projectMessages[currentTargetId] || []), newMsg],
          },
          isTyping: {
            ...s.isTyping,
            [currentTargetId]: true,
          },
        }));

        // Trigger contextual agent response
        setTimeout(() => {
          const replyContent = isGlobal
            ? buildGlobalAgentReply(text)
            : buildProjectAgentReply(text, meta, attachments);

          const agentMsg: ChatMessage = {
            id: `msg-agent-${Date.now()}`,
            projectId: currentTargetId,
            sender: 'agent',
            senderName: DEFAULT_AGENT.name,
            senderRole: DEFAULT_AGENT.role,
            content: replyContent,
            timestamp: nowLabel(),
            isRead: get().isOpen && get().activeProjectId === currentTargetId,
          };

          set((s) => ({
            projectMessages: {
              ...s.projectMessages,
              [currentTargetId]: [...(s.projectMessages[currentTargetId] || []), agentMsg],
            },
            isTyping: {
              ...s.isTyping,
              [currentTargetId]: false,
            },
          }));
        }, 1300);
      },

      toggleReaction: (projectId, messageId, emoji) => {
        set((s) => {
          const msgs = s.projectMessages[projectId] || [];
          const updated = msgs.map((m) => {
            if (m.id !== messageId) return m;
            const reactions = m.reactions ? [...m.reactions] : [];
            const existingIdx = reactions.findIndex((r) => r.emoji === emoji);
            if (existingIdx >= 0) {
              const current = reactions[existingIdx];
              if (current.reacted) {
                if (current.count <= 1) {
                  reactions.splice(existingIdx, 1);
                } else {
                  reactions[existingIdx] = { ...current, count: current.count - 1, reacted: false };
                }
              } else {
                reactions[existingIdx] = { ...current, count: current.count + 1, reacted: true };
              }
            } else {
              reactions.push({ emoji, count: 1, reacted: true });
            }
            return { ...m, reactions };
          });
          return {
            projectMessages: {
              ...s.projectMessages,
              [projectId]: updated,
            },
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        activeProjectId: s.activeProjectId,
        projectMessages: s.projectMessages,
        projectMeta: s.projectMeta,
      }),
      version: 5,
      skipHydration: true,
    }
  )
);

function importLegacyProjectHistory() {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Check v2
    const v2Raw = localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    if (v2Raw) {
      const parsed = JSON.parse(v2Raw);
      const msgs = parsed?.state?.messages || parsed?.messages;
      if (Array.isArray(msgs) && msgs.length > 0) {
        const demoId = DEFAULT_DEMO_PROJECT.id;
        const normalized: ChatMessage[] = msgs.map((m: Partial<ChatMessage>) => ({
          ...m,
          id: m.id || `msg-${Date.now()}`,
          projectId: demoId,
          sender: m.sender || 'agent',
          senderName: m.senderName || 'Sarah Miller',
          content: m.content || '',
          timestamp: m.timestamp || 'Today at 10:00 AM',
          isRead: true,
        }));
        useChatStore.setState({
          projectMessages: { [demoId]: normalized },
          activeProjectId: demoId,
        });
        localStorage.removeItem(LEGACY_STORAGE_KEY_V2);
        return;
      }
    }

    // Check v1
    const v1Raw = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (v1Raw) {
      const parsed = JSON.parse(v1Raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const demoId = DEFAULT_DEMO_PROJECT.id;
        useChatStore.setState({
          projectMessages: { [demoId]: parsed as ChatMessage[] },
          activeProjectId: demoId,
        });
        localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
      }
    }
    // Ensure global chat always exists
    if (!useChatStore.getState().projectMessages[GLOBAL_CHAT_ID]) {
      useChatStore.setState((s) => ({
        projectMessages: {
          ...s.projectMessages,
          [GLOBAL_CHAT_ID]: createInitialGlobalMessages(),
        },
        projectMeta: {
          ...s.projectMeta,
          [GLOBAL_CHAT_ID]: GLOBAL_META,
        },
      }));
    }
  } catch {
    // Corrupt legacy data discarded
  }
}

let hydrationStarted = false;

export function useStudioChat(scopedProjectId?: string) {
  useEffect(() => {
    if (!hydrationStarted) {
      hydrationStarted = true;
      void Promise.resolve(useChatStore.persist.rehydrate()).then(importLegacyProjectHistory);
    }
  }, []);

  const {
    activeProjectId,
    projectMessages,
    projectMeta,
    isOpen,
    isTyping,
    setActiveProjectId,
    setIsOpen,
    markProjectAsRead,
    sendMessage,
    toggleReaction,
    registerProject,
  } = useChatStore(
    useShallow((s) => ({
      activeProjectId: s.activeProjectId,
      projectMessages: s.projectMessages,
      projectMeta: s.projectMeta,
      isOpen: s.isOpen,
      isTyping: s.isTyping,
      setActiveProjectId: s.setActiveProjectId,
      setIsOpen: s.setIsOpen,
      markProjectAsRead: s.markProjectAsRead,
      sendMessage: s.sendMessage,
      toggleReaction: s.toggleReaction,
      registerProject: s.registerProject,
    }))
  );

  const effectiveProjectId = scopedProjectId || activeProjectId || GLOBAL_CHAT_ID;
  const isGlobal = effectiveProjectId === GLOBAL_CHAT_ID;
  const messages = projectMessages[effectiveProjectId] || (isGlobal ? createInitialGlobalMessages() : []);
  const currentMeta = isGlobal ? GLOBAL_META : (projectMeta[effectiveProjectId] || DEFAULT_DEMO_PROJECT);
  const isCurrentTyping = Boolean(isTyping[effectiveProjectId]);

  // Project unread count
  const unreadCount = messages.filter((m) => m.sender === 'agent' && !m.isRead).length;

  // Total unread count across all project conversations
  let totalUnreadCount = 0;
  const unreadCounts: Record<string, number> = {};

  for (const [pId, pMsgs] of Object.entries(projectMessages)) {
    const count = (pMsgs || []).filter((m) => m.sender === 'agent' && !m.isRead).length;
    unreadCounts[pId] = count;
    totalUnreadCount += count;
  }

  const handleSendMessage = useCallback(
    (text: string, attachments?: ChatAttachment[]) =>
      sendMessage(text, attachments, effectiveProjectId),
    [sendMessage, effectiveProjectId]
  );

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) =>
      toggleReaction(effectiveProjectId, messageId, emoji),
    [toggleReaction, effectiveProjectId]
  );

  const handleMarkAllAsRead = useCallback(
    () => markProjectAsRead(effectiveProjectId),
    [markProjectAsRead, effectiveProjectId]
  );

  return {
    projectId: effectiveProjectId,
    isGlobal,
    projectMeta: currentMeta,
    allProjectsMeta: projectMeta,
    projectMessages,
    messages,
    agent: DEFAULT_AGENT,
    isOpen,
    isTyping: isCurrentTyping,
    unreadCount,
    totalUnreadCount,
    unreadCounts,
    setActiveProjectId,
    setIsOpen,
    sendMessage: handleSendMessage,
    toggleReaction: handleToggleReaction,
    markAllAsRead: handleMarkAllAsRead,
    registerProject,
  };
}
