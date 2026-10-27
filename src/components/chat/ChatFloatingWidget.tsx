'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ChatGate } from '@/components/chat/ChatGate';

const ChatFloatingWidgetInner = dynamic(
  () => import('./ChatFloatingWidgetInner').then((m) => m.ChatFloatingWidgetInner),
  { ssr: false }
);

export function ChatFloatingWidget() {
  return (
    <ChatGate>
      <ChatFloatingWidgetInner />
    </ChatGate>
  );
}
