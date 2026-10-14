'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ChatFullView } from '@/components/chat/ChatFullView';
import { ChatGate } from '@/components/chat/ChatGate';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';
import { useChatStore } from '@/lib/chatStore';

function RedirectToProjects() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/projects');
  }, [router]);
  return null;
}

function ProjectQuerySync() {
  const searchParams = useSearchParams();
  const projectParam = searchParams.get('project') || searchParams.get('thread');

  useEffect(() => {
    if (projectParam) {
      useChatStore.getState().setActiveProjectId(projectParam);
    }
  }, [projectParam]);

  return null;
}

export default function MessagesPage() {
  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={<StudioNewProjectButton />}
    >
      <div className="space-y-4 pb-20 sm:pb-28 animate-in fade-in duration-200">
        <ChatGate fallback={<RedirectToProjects />}>
          <Suspense fallback={null}>
            <ProjectQuerySync />
          </Suspense>
          <div data-chat-entry="messages-page">
            <ChatFullView />
          </div>
        </ChatGate>
      </div>
    </StudioCardLayout>
  );
}
