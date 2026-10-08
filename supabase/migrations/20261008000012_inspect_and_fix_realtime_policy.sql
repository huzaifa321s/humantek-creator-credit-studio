-- Migration 12: Realtime Policy Robustness & Diagnostic RPC

-- 1. Helper function to inspect realtime policies
create or replace function public.check_realtime_policies()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'schemaname', schemaname,
    'tablename', tablename,
    'policyname', policyname,
    'permissive', permissive,
    'roles', roles,
    'cmd', cmd,
    'qual', qual
  )) into v_res
  from pg_policies
  where schemaname = 'realtime' and tablename = 'messages';

  return coalesce(v_res, '[]'::jsonb);
end;
$$;

revoke execute on function public.check_realtime_policies from public, anon, authenticated;
grant execute on function public.check_realtime_policies to service_role;

-- 2. Drop existing policy and apply robust split_part / topic matcher
drop policy if exists "members receive project events" on realtime.messages;
drop policy if exists "temp allow authenticated" on realtime.messages;

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
        or (select realtime.topic()) like '%' || p.id::text
      )
      and (p.user_id = (select auth.uid()) or public.is_admin())
    )
  )
);
