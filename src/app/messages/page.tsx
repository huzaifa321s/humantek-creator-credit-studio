'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ChatFullView } from '@/components/chat/ChatFullView';
import { ChatGate } from '@/components/chat/ChatGate';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';

function RedirectToProjects() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/projects');
  }, [router]);
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
          <div data-chat-entry="messages-page">
            <ChatFullView />
          </div>
        </ChatGate>
      </div>
    </StudioCardLayout>
  );
}
