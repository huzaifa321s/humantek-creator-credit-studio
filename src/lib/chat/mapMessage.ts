import type { ChatMessage } from '@/lib/chatStore';
import { formatChatTimestamp } from '@/lib/utils';
import type { ProjectChatMessage } from './useProjectChat';

/** Unified display name used for all studio/admin messages across the chat system. */
export const STUDIO_TEAM_NAME = 'Studio Team';

const STAFF_ROLES = new Set(['admin', 'manager']);
const LEGACY_STAFF_NAMES = new Set([
  'humantek admin',
  'humantek studio',
  'studio member',
  'studio team',
  'admin',
]);

export function isStaffRole(role?: string | null): boolean {
  return Boolean(role && STAFF_ROLES.has(role));
}

function normalizeReplyTo(
  replyTo?: ProjectChatMessage['replyTo']
): ChatMessage['replyTo'] {
  if (!replyTo) return undefined;
  const rawName = (replyTo.senderName || '').trim();
  const isStaffQuote =
    replyTo.senderRole === 'Studio Team' ||
    isStaffRole(replyTo.senderRole) ||
    LEGACY_STAFF_NAMES.has(rawName.toLowerCase());

  return {
    ...replyTo,
    senderName: isStaffQuote ? STUDIO_TEAM_NAME : rawName || STUDIO_TEAM_NAME,
  };
}

function clientDisplayName(name?: string | null, fallbackClientName?: string): string {
  const trimmed = name?.trim();
  if (trimmed && trimmed.toLowerCase() !== 'client' && trimmed.toLowerCase() !== 'creator') {
    return trimmed;
  }
  const fallback = fallbackClientName?.trim();
  if (fallback && fallback.toLowerCase() !== 'client' && fallback.toLowerCase() !== 'creator') {
    return fallback;
  }
  return trimmed || fallback || 'Client';
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Maps a server message into the shared `ChatMessage` shape used by the chat UI.
 * Staff (admin / manager) messages render as `agent` under the single `Studio Team` identity.
 */
export function mapProjectChatMessage(
  m: ProjectChatMessage,
  options: { clientName?: string; lastReadId: number }
): ChatMessage {
  const isStaff = isStaffRole(m.sender?.role);
  const isImage = (mime: string) => mime.startsWith('image/');

  return {
    id: String(m.id),
    clientMessageId: m.clientMessageId || undefined,
    projectId: m.projectId,
    senderId: m.senderId || (isStaff ? 'admin-1' : 'client-1'),
    staffName: isStaff ? m.sender?.staffName || null : null,
    clientUserId: m.clientUserId ?? null,
    sender: m.kind === 'system' ? 'system' : isStaff ? 'agent' : 'client',
    senderName: isStaff
      ? STUDIO_TEAM_NAME
      : clientDisplayName(m.sender?.name, options.clientName),
    senderRole: isStaff ? STUDIO_TEAM_NAME : 'Creator',
    senderAvatarUrl: isStaff ? null : m.sender?.avatarUrl || null,
    content: m.body,
    replyTo: normalizeReplyTo(m.replyTo),
    likes: m.likes || [],
    isEdited: Boolean(m.isEdited),
    editedAt: m.editedAt || undefined,
    isDeleted: Boolean(m.isDeleted),
    createdAtRaw: m.createdAt,
    timestamp: formatChatTimestamp(m.createdAt),
    isRead: m.id <= options.lastReadId,
    status: 'sent',
    attachments: (m.attachments || []).map((att) => ({
      id: att.id,
      name: att.fileName,
      size: formatFileSize(att.fileSize),
      type: isImage(att.mimeType) ? 'image' : 'file',
      url: att.url || '',
      previewUrl: isImage(att.mimeType) ? att.url || '' : undefined,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
    })),
  };
}
