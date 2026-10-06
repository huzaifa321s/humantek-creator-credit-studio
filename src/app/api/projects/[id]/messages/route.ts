import { NextRequest, NextResponse } from 'next/server';
import { getProjectById, getProjectMessages, addProjectMessage, markProjectMessagesRead } from '@/lib/store';
import { getRequestUser } from '@/lib/auth';
import type { ChatMessage, ChatAttachment } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const project = getProjectById(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const user = await getRequestUser();
  if (user && !user.isAdmin && project.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const messages = getProjectMessages(project.id);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const project = getProjectById(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: {
    content?: string;
    attachments?: ChatAttachment[];
    sender?: 'client' | 'agent' | 'system';
    senderName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = (body.content || '').trim();
  const attachments = body.attachments || [];

  if (!content && attachments.length === 0) {
    return NextResponse.json({ error: 'Message content or attachment required' }, { status: 400 });
  }

  const user = await getRequestUser();
  const sender = body.sender || (user?.isAdmin ? 'agent' : 'client');
  const senderName =
    body.senderName ||
    (sender === 'client' ? project.clientName || 'Client' : 'Sarah Miller');

  const nowLabel = `Today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId: project.id,
    sender,
    senderName,
    senderRole: sender === 'agent' ? 'Senior Creative Producer' : undefined,
    content,
    timestamp: nowLabel,
    attachments: attachments.length > 0 ? attachments : undefined,
    isRead: true,
  };

  addProjectMessage(project.id, newMsg);

  return NextResponse.json({ success: true, message: newMsg });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const project = getProjectById(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  markProjectMessagesRead(project.id);
  return NextResponse.json({ success: true });
}
