import type { ChatMessage } from '@/types';
import { formatChatTimestamp } from '@/lib/utils';
import type { ProjectChatMessage } from './useProjectChat';

/** Display name used when a staff member has no name on their profile. */
export const STUDIO_TEAM_NAME = 'Humantek Studio';

const STAFF_ROLES = new Set(['admin', 'manager']);

export function isStaffRole(role?: string | null): boolean {
  return Boolean(role && STAFF_ROLES.has(role));
}

function staffDisplayName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed && trimmed !== 'Studio Member' ? trimmed : STUDIO_TEAM_NAME;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Maps a server message into the shared `ChatMessage` shape used by the chat UI.
 * Staff (admin / manager) messages render as `agent`; everyone else as `client`.
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
    sender: m.kind === 'system' ? 'system' : isStaff ? 'agent' : 'client',
    senderName: isStaff ? staffDisplayName(m.sender?.name) : m.sender?.name?.trim() || options.clientName || 'Client',
    senderRole: isStaff ? 'Studio team' : 'Creator',
    content: m.body,
    replyTo: m.replyTo || undefined,
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
