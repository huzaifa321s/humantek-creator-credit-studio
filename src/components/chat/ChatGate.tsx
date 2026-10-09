'use client';

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useUserStore } from '@/lib/userStore';
import { useProjectsQuery } from '@/lib/queries/projects';

interface ChatGateContextValue {
  canChat: boolean;
  isClient: boolean;
  isEmailVerified: boolean;
  hasProjects: boolean;
  isLoading: boolean;
}

const ChatGateContext = createContext<ChatGateContextValue>({
  canChat: false,
  isClient: false,
  isEmailVerified: false,
  hasProjects: false,
  isLoading: false,
});

export function ChatGateProvider({
  children,
  initialCanChat = false,
}: {
  children: React.ReactNode;
  initialCanChat?: boolean;
}) {
  const { user, isHydrated, isAdmin } = useUserStore();
  const effectiveEmail = user?.email;
  const isClient = Boolean(
    effectiveEmail &&
    (user?.role === 'client' || (!user?.role && !isAdmin())) &&
    user?.role !== 'admin'
  );

  // Only query projects if authenticated as a non-admin client
  const projectsQuery = useProjectsQuery({
    enabled: Boolean(isClient && effectiveEmail),
  });

  const isEmailVerified = Boolean(user?.emailVerified ?? true);
  const projectCount = projectsQuery.data?.length ?? 0;
  const hasProjects = projectCount > 0 || Boolean(user?.hasProjects);

  // Authoritative canChat: signed-in client with verified email who owns a project
  const canChat = Boolean(
    effectiveEmail &&
    isClient &&
    isEmailVerified &&
    hasProjects
  );

  // Automatically purge any chat storage keys whenever canChat is false
  useEffect(() => {
    if (!canChat && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('humantek_project_chat_v6');
        localStorage.removeItem('humantek_client_chat_v2');
        localStorage.removeItem('humantek_client_chat_messages_v1');
        sessionStorage.removeItem('humantek_project_chat_v6');
        sessionStorage.removeItem('humantek_client_chat_v2');
      } catch {}
    }
  }, [canChat]);

  const value = useMemo(
    () => ({
      canChat,
      isClient,
      isEmailVerified,
      hasProjects,
      isLoading: !isHydrated || (Boolean(effectiveEmail) && projectsQuery.isPending),
    }),
    [canChat, isClient, isEmailVerified, hasProjects, isHydrated, effectiveEmail, projectsQuery.isPending]
  );

  return <ChatGateContext.Provider value={value}>{children}</ChatGateContext.Provider>;
}

export function useChatGate() {
  return useContext(ChatGateContext);
}

export function ChatGate({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canChat } = useChatGate();
  if (!canChat) return <>{fallback}</>;
  return <>{children}</>;
}
