-- Migration: 20261016000001_harden_global_chat_rls.sql
-- Hardens RLS policies on project_messages and project_message_attachments for the 'global'
-- inquiry channel so clients can only read their own 1-on-1 inquiry messages and attachments,
-- while Studio Management roles (profiles.role = 'admin') can read all threads.

create or replace function public.can_read_global_message(p_sender_id uuid, p_body text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_client_id text;
begin
  if v_uid is null then
    return false;
  end if;

  if p_sender_id = v_uid then
    return true;
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = v_uid and pr.role = 'admin'
  ) then
    return true;
  end if;

  if p_body is not null and left(p_body, 1) = '{' then
    begin
      v_client_id := (p_body::jsonb) ->> 'clientUserId';
      if v_client_id = v_uid::text then
        return true;
      end if;
    exception when others then
      return false;
    end;
  end if;

  return false;
end;
$$;

drop policy if exists "members and admin read messages" on public.project_messages;
create policy "members and admin read messages" on public.project_messages
  for select
  using (
    (project_id = 'global' and public.can_read_global_message(sender_id, body))
    or (
      project_id <> 'global'
      and exists (
        select 1 from public.projects p
        where p.id = project_messages.project_id
          and (p.user_id = auth.uid() or exists (
            select 1 from public.profiles pr
            where pr.id = auth.uid() and pr.role = 'admin'
          ))
      )
    )
  );

drop policy if exists "members and admin read attachments" on public.project_message_attachments;
create policy "members and admin read attachments" on public.project_message_attachments
  for select
  using (
    (
      project_id = 'global'
      and exists (
        select 1 from public.project_messages pm
        where pm.id = project_message_attachments.message_id
          and public.can_read_global_message(pm.sender_id, pm.body)
      )
    )
    or (
      project_id <> 'global'
      and exists (
        select 1 from public.projects p
        where p.id = project_message_attachments.project_id
          and (p.user_id = auth.uid() or exists (
            select 1 from public.profiles pr
            where pr.id = auth.uid() and pr.role = 'admin'
          ))
      )
    )
  );
