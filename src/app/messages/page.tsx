'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ChatFullView } from '@/components/chat/ChatFullView';
import { ChatGate } from '@/components/chat/ChatGate';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

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
      topRightBadge={
        <Link href="/new-project">
          <Button
            variant="gold"
            size="sm"
            className="gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden min-[400px]:inline">New Project</span>
            <span className="min-[400px]:hidden">New</span>
          </Button>
        </Link>
      }
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
