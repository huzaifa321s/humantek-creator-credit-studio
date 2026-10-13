-- ============================================================
-- MIGRATION: 20261013000009_notification_entity_columns.sql
-- Store entity_type and entity_id for stable, canonical deep linking
-- ============================================================

alter table public.notifications
  add column if not exists entity_type text,
  add column if not exists entity_id text;

create index if not exists idx_notifications_entity 
  on public.notifications (entity_type, entity_id);
