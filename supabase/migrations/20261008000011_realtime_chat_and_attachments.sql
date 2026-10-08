-- ============================================================
-- MIGRATION 11: SECURE REALTIME STUDIO CHAT, ATTACHMENTS & READ STATES
-- ============================================================

-- 1. Denormalized inbox columns on public.projects (O(1) admin inbox queries)
alter table public.projects 
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_preview text;

-- 2. Project Messages Table
create table if not exists public.project_messages (
  id bigint generated always as identity primary key,
  project_id text not null references public.projects(id) on delete restrict,
  sender_id uuid references public.profiles(id) on delete restrict,
  kind text not null default 'user' check (kind in ('user', 'system')),
  body text not null check (char_length(body) between 1 and 4000),
  client_message_id text check (client_message_id is null or char_length(client_message_id) <= 128),
  created_at timestamptz not null default now(),
  constraint project_messages_system_or_user_check check (
    kind = 'system' or (client_message_id is not null and sender_id is not null)
  ),
  -- Scope idempotency per (project_id, sender_id, client_message_id) to prevent cross-user key collision
  constraint project_messages_sender_client_id_key unique (project_id, sender_id, client_message_id)
);

-- Performance Composite Indexes
create index if not exists project_messages_project_id_id_idx 
  on public.project_messages (project_id, id);

create index if not exists project_messages_created_at_idx
  on public.project_messages (project_id, created_at desc);

-- RLS: Read-only for authenticated members/admin; strictly no direct client writes
alter table public.project_messages enable row level security;
alter table public.project_messages force row level security;
revoke all on table public.project_messages from public, anon, authenticated;
grant select on table public.project_messages to authenticated;

drop policy if exists "members and admin read messages" on public.project_messages;
create policy "members and admin read messages" on public.project_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_messages.project_id
        and (p.user_id = (select auth.uid()) or public.is_admin())
    )
  );

-- 3. Project Read States Table
-- NOTE: Read-states are mutated strictly through the Next.js API route using service_role.
-- Clients are never granted direct INSERT/UPDATE/DELETE.
create table if not exists public.project_read_states (
  project_id text not null references public.projects(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  last_read_message_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_read_states enable row level security;
alter table public.project_read_states force row level security;
revoke all on table public.project_read_states from public, anon, authenticated;
grant select on table public.project_read_states to authenticated;

-- Users may only view their own read state (or admin can view)
drop policy if exists "users read own read state" on public.project_read_states;
create policy "users read own read state" on public.project_read_states
  for select to authenticated
  using (
    user_id = (select auth.uid()) or public.is_admin()
  );

-- 4. Project Message Attachments Table
create table if not exists public.project_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references public.project_messages(id) on delete restrict,
  project_id text not null references public.projects(id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  file_size integer not null check (file_size > 0 and file_size <= 52428800), -- 50 MB max limit
  mime_type text not null check (
    mime_type in (
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf', 'application/zip', 'application/x-zip-compressed',
      'application/vnd.adobe.photoshop', 'application/illustrator'
    )
  ),
  is_deliverable boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists project_message_attachments_message_id_idx
  on public.project_message_attachments (message_id);

alter table public.project_message_attachments enable row level security;
alter table public.project_message_attachments force row level security;
revoke all on table public.project_message_attachments from public, anon, authenticated;
grant select on table public.project_message_attachments to authenticated;

drop policy if exists "members and admin read attachments" on public.project_message_attachments;
create policy "members and admin read attachments" on public.project_message_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_message_attachments.project_id
        and (p.user_id = (select auth.uid()) or public.is_admin())
    )
  );

-- 5. Non-Blocking Realtime Doorbell Database Trigger
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview text;
begin
  -- Update project last_message metadata for fast inbox sorting without message table scans
  v_preview := left(new.body, 120);
  update public.projects set
    last_message_at = new.created_at,
    last_message_preview = v_preview
  where id = new.project_id;

  -- Safe, non-blocking broadcast: realtime failures will NEVER abort the message insert
  begin
    perform realtime.send(
      jsonb_build_object(
        'project_id', new.project_id,
        'message_id', new.id,
        'kind', new.kind
      ),
      'new_message',
      'project:' || new.project_id::text,
      true -- Private broadcast channel
    );
  exception when others then
    -- Suppress: message is safely saved in PostgreSQL, polling/overlap recovers it
    null;
  end;

  return new;
end;
$$;

revoke execute on function public.notify_new_message from public, anon, authenticated;
grant execute on function public.notify_new_message to service_role;

drop trigger if exists on_project_message_insert on public.project_messages;
create trigger on_project_message_insert
  after insert on public.project_messages
  for each row execute function public.notify_new_message();

-- 6. Private Broadcast Channel RLS on realtime.messages
-- Clients must only receive events for projects they belong to or if they are admin
-- Notice: ZERO send policy is created for authenticated clients!
drop policy if exists "members receive project events" on realtime.messages;
create policy "members receive project events" on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast' and exists (
      select 1 from public.projects p
      where 'project:' || p.id::text = (select realtime.topic())
        and (p.user_id = (select auth.uid()) or public.is_admin())
    )
  );

-- 7. Update audit_database_grants to include chat tables and function
create or replace function public.audit_database_grants()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_funcs jsonb;
  v_tables jsonb;
begin
  if not public.is_admin() then
    raise exception 'unauthorized_admin_required';
  end if;

  select jsonb_agg(jsonb_build_object(
    'routine_name', p.proname,
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )) into v_funcs
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'fulfill_order', 'handle_refund', 'handle_reversal', 'confirm_manual_payment',
      'update_project_status', 'spend_credits', 'redeem_promo', 'ledger_post', 'is_admin',
      'notify_new_message'
    );

  select jsonb_agg(jsonb_build_object(
    'table_name', tablename,
    'anon_select', has_table_privilege('anon', 'public.' || tablename, 'SELECT'),
    'anon_insert', has_table_privilege('anon', 'public.' || tablename, 'INSERT'),
    'anon_update', has_table_privilege('anon', 'public.' || tablename, 'UPDATE'),
    'anon_delete', has_table_privilege('anon', 'public.' || tablename, 'DELETE'),
    'authenticated_select', has_table_privilege('authenticated', 'public.' || tablename, 'SELECT'),
    'authenticated_insert', has_table_privilege('authenticated', 'public.' || tablename, 'INSERT'),
    'authenticated_update', has_table_privilege('authenticated', 'public.' || tablename, 'UPDATE'),
    'authenticated_delete', has_table_privilege('authenticated', 'public.' || tablename, 'DELETE')
  )) into v_tables
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'wallets', 'credit_ledger', 'orders', 'projects', 'promo_codes', 
      'admin_alerts', 'webhook_events', 'project_status_history',
      'project_messages', 'project_read_states', 'project_message_attachments'
    );

  return jsonb_build_object('functions', v_funcs, 'tables', v_tables);
end;
$$;

revoke execute on function public.audit_database_grants from public, anon, authenticated;
grant execute on function public.audit_database_grants to service_role;

