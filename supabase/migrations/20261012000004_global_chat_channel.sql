-- Migration: 20261012000004_global_chat_channel.sql
-- Enables first-class global studio support chat ('global') without requiring a dummy project.

-- 1. Drop foreign key constraints on project_id so 'global' is permitted.
alter table public.project_messages
  drop constraint if exists project_messages_project_id_fkey;

alter table public.project_message_attachments
  drop constraint if exists project_message_attachments_project_id_fkey;

alter table public.project_read_states
  drop constraint if exists project_read_states_project_id_fkey;

-- 2. Update RLS policy on project_messages to allow all authenticated users to read 'global' messages
drop policy if exists "members and admin read messages" on public.project_messages;
create policy "members and admin read messages" on public.project_messages
  for select
  using (
    project_id = 'global'
    or exists (
      select 1 from public.projects p
      where p.id = project_messages.project_id
        and (p.user_id = auth.uid() or exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and pr.role = 'admin'
        ))
    )
  );

-- 3. Update RLS policy on project_message_attachments to allow all authenticated users to read 'global' attachments
drop policy if exists "members and admin read attachments" on public.project_message_attachments;
create policy "members and admin read attachments" on public.project_message_attachments
  for select
  using (
    project_id = 'global'
    or exists (
      select 1 from public.projects p
      where p.id = project_message_attachments.project_id
        and (p.user_id = auth.uid() or exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and pr.role = 'admin'
        ))
    )
  );

-- 4. Update notify_new_message() trigger to safely bypass project table update for 'global'
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text;
  v_preview text;
begin
  v_text := new.body;
  if v_text like '{"v":1,%' then
    begin
      v_text := coalesce((v_text::jsonb) ->> 'text', '');
    exception when others then
      v_text := new.body;
    end;
  end if;

  v_preview := left(nullif(btrim(v_text), ''), 120);
  if v_preview is null then
    v_preview := 'Sent an image';
  end if;

  if new.project_id <> 'global' then
    update public.projects set
      last_message_at = new.created_at,
      last_message_preview = v_preview
    where id = new.project_id;
  end if;

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
      false
    );
  exception when others then
    -- Ignore realtime broadcast errors to prevent transaction rollback
  end;

  return new;
end;
$$;
