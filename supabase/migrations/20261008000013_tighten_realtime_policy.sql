-- Migration 13: Tighten Realtime Policy (Remove substring/LIKE matching)

drop policy if exists "members receive project events" on realtime.messages;

create policy "members receive project events"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and (
    exists (
      select 1 from public.projects p
      where (
        p.id = split_part((select realtime.topic()), ':', 2)
        or 'project:' || p.id::text = (select realtime.topic())
      )
      and (p.user_id = (select auth.uid()) or public.is_admin())
    )
  )
);
