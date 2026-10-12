-- ============================================================
-- MIGRATION 20261012000002: CHAT REPLIES, THUMB LIKES, EDITING & SOFT DELETION
-- ============================================================
-- Note: The application API uses a robust backward-compatible envelope pattern
-- within `project_messages.body` (e.g. {"v":1,"text":"...","replyTo":...}),
-- ensuring zero downtime, instant rollback safety, and full realtime event support.
--
-- The schema below documents and establishes the relational columns and constraints
-- for native column reflection if direct SQL projections are desired.

alter table public.project_messages
  add column if not exists reply_to_id bigint references public.project_messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists likes jsonb not null default '[]'::jsonb;

-- Composite index to accelerate nested reply lookups
create index if not exists project_messages_reply_to_idx
  on public.project_messages (reply_to_id)
  where reply_to_id is not null;

-- Partial index for active non-deleted messages
create index if not exists project_messages_active_idx
  on public.project_messages (project_id, created_at desc)
  where is_deleted = false;

comment on column public.project_messages.reply_to_id is 'Optional parent message reference for replies';
comment on column public.project_messages.edited_at is 'Timestamp of the latest edit within the 60-minute edit window';
comment on column public.project_messages.is_deleted is 'Soft-deletion flag preserving conversation thread integrity';
comment on column public.project_messages.likes is 'JSON array of thumbs-up likes: [{"userId":"...","userName":"...","likedAt":"..."}]';
