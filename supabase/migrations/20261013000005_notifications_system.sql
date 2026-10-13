-- ============================================================
-- MIGRATION: 20261013000005_notifications_system.sql
-- Dedicated notifications table with RLS, indexes & realtime
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'project_status',
    'payment_confirmed',
    'wallet_credit',
    'chat_message',
    'order_status',
    'system_alert'
  )),
  title text not null,
  message text not null,
  link text,
  action_label text,
  action_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Fast query indexes
create index if not exists idx_notifications_user_unread 
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists idx_notifications_created_at 
  on public.notifications (created_at desc);

-- Enable Row Level Security (RLS)
alter table public.notifications enable row level security;

-- Policies:
-- 1. Users can view their own notifications
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- 2. Users can update (mark as read) their own notifications
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- 3. Users can delete (dismiss) their own notifications
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- 4. Enable Realtime on notifications
alter publication supabase_realtime add table public.notifications;

-- Helper function to insert notifications from trusted security definer triggers or RPC
create or replace function public.create_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text default null,
  p_action_label text default null,
  p_action_id text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    link,
    action_label,
    action_id
  ) values (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_link,
    p_action_label,
    p_action_id
  ) returning id into v_id;

  return v_id;
end;
$$;
