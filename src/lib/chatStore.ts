'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  size?: string;
  type: 'image' | 'file';
  previewUrl?: string;
}

export interface ChatOrderCard {
  projectCode: string;
  packageName: string;
  credits: number;
  status: string;
  price: number;
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'agent' | 'system';
  senderName: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  orderCard?: ChatOrderCard;
  isRead?: boolean;
}

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

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'system',
    senderName: 'Humantek Studio System',
    content: 'Client Chat Channel Connected · Assigned to Sarah Miller (Lead Producer)',
    timestamp: 'Today at 10:14 AM',
    isRead: true,
  },
  {
    id: 'msg-2',
    sender: 'agent',
    senderName: 'Sarah Miller',
    senderRole: 'Senior Creative Producer',
    content:
      "Hi there! Welcome to Humantek Creator Studio. I'm Sarah, your dedicated creative producer. Whether you need help choosing a credit package, want to review style moodboards, or have questions about delivery milestones, I'm here to assist!",
    timestamp: 'Today at 10:15 AM',
    isRead: true,
  },
  {
    id: 'msg-3',
    sender: 'client',
    senderName: 'You (Creator)',
    content:
      "Hi Sarah! We are planning a full channel rebrand for our stream. We're aiming for a high-contrast Cyberpunk aesthetic with animated stingers and custom overlays. Here is our current visual moodboard:",
    timestamp: 'Today at 10:18 AM',
    attachments: [SAMPLE_REFERENCES[0]],
    isRead: true,
  },
  {
    id: 'msg-4',
    sender: 'agent',
    senderName: 'Sarah Miller',
    senderRole: 'Senior Creative Producer',
    content:
      "This neon palette is fantastic! The magenta/cyan color grading pairs perfectly with our Elite 3D stinger workflow. With our Creator Pro or Forge package, you'll have plenty of credits for 3 animated stingers, 3 stream overlays, and custom alert badges.",
    timestamp: 'Today at 10:21 AM',
    orderCard: {
      projectCode: 'HT-9428-FORGE',
      packageName: 'Creator Forge (Recommended)',
      credits: 660,
      status: 'Active Studio Queue',
      price: 1500,
    },
    isRead: false,
  },
];

const STORAGE_KEY = 'humantek_client_chat_messages_v1';
const CHAT_OPEN_KEY = 'humantek_client_chat_open';

// Global listeners for cross-component synchronization
type Listener = () => void;
let globalMessages: ChatMessage[] = INITIAL_MESSAGES;
let globalIsOpen = false;
let globalIsTyping = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function useStudioChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(globalMessages);
  const [isOpen, setIsOpenState] = useState<boolean>(globalIsOpen);
  const [isTyping, setIsTypingState] = useState<boolean>(globalIsTyping);

  // Initialize from localStorage once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            globalMessages = parsed;
            setMessages(parsed);
          }
        }
      } catch (err) {
        console.error('Failed to load chat from storage', err);
      }
    }
  }, []);

  // Subscribe to changes across floating widget and messages page
  useEffect(() => {
    const handleSync = () => {
      setMessages([...globalMessages]);
      setIsOpenState(globalIsOpen);
      setIsTypingState(globalIsTyping);
    };

    listeners.add(handleSync);
    return () => {
      listeners.delete(handleSync);
    };
  }, []);

  const setIsOpen = useCallback((open: boolean) => {
    globalIsOpen = open;
    if (open) {
      // Mark messages as read when opening
      globalMessages = globalMessages.map((m) => ({ ...m, isRead: true }));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(globalMessages));
      } catch {}
    }
    notify();
  }, []);

  const markAllAsRead = useCallback(() => {
    globalMessages = globalMessages.map((m) => ({ ...m, isRead: true }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalMessages));
    } catch {}
    notify();
  }, []);

  const sendMessage = useCallback(
    (text: string, attachments?: ChatAttachment[]) => {
      if (!text.trim() && (!attachments || attachments.length === 0)) return;

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'client',
        senderName: 'You (Creator)',
        content: text.trim(),
        timestamp: `Today at ${timeStr}`,
        attachments,
        isRead: true,
      };

      globalMessages = [...globalMessages, newMsg];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(globalMessages));
      } catch {}
      notify();

      // Trigger realistic agent response
      simulateAgentReply(text, attachments);
    },
    []
  );

  const simulateAgentReply = (clientText: string, attachments?: ChatAttachment[]) => {
    globalIsTyping = true;
    notify();

    setTimeout(() => {
      globalIsTyping = false;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let replyContent = "Thanks for the details! I've noted this in your creative profile. Our lead art director will verify the scope.";

      const lower = clientText.toLowerCase();
      if (attachments && attachments.length > 0) {
        replyContent = `Received your reference asset (${attachments[0].name})! I've pinned this into your studio asset board so our production team matches this exact aesthetic.`;
      } else if (lower.includes('credit') || lower.includes('rollover') || lower.includes('balance')) {
        replyContent =
          'All Humantek package credits are valid for a full 12 months with rollover protection! You can allocate credits as needed across multiple requests or hold them in reserve.';
      } else if (lower.includes('3d') || lower.includes('vtuber') || lower.includes('animation')) {
        replyContent =
          'Our 3D & VTuber pipeline handles full rigging, blendshapes, physics tracking, and stream-ready VSeeFace/Warudo exports. Would you like us to review your character design sheet?';
      } else if (lower.includes('status') || lower.includes('order') || lower.includes('queue')) {
        replyContent =
          'Your active package (HT-9428-FORGE) is currently in production. Milestone 1 (concept thumbnails and color passes) will be ready for your review in 48 hours!';
      } else if (lower.includes('price') || lower.includes('discount') || lower.includes('voucher')) {
        replyContent =
          'If you have a studio voucher code, you can apply it directly in Step 4 of the studio builder or at /redeem-code for instant bonus credits!';
      }

      const agentMsg: ChatMessage = {
        id: `msg-agent-${Date.now()}`,
        sender: 'agent',
        senderName: DEFAULT_AGENT.name,
        senderRole: DEFAULT_AGENT.role,
        content: replyContent,
        timestamp: `Today at ${timeStr}`,
        isRead: globalIsOpen,
      };

      globalMessages = [...globalMessages, agentMsg];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(globalMessages));
      } catch {}
      notify();
    }, 1400);
  };

  const unreadCount = messages.filter((m) => m.sender === 'agent' && !m.isRead).length;

  return {
    messages,
    agent: DEFAULT_AGENT,
    isOpen,
    isTyping,
    unreadCount,
    setIsOpen,
    sendMessage,
    markAllAsRead,
  };
}
