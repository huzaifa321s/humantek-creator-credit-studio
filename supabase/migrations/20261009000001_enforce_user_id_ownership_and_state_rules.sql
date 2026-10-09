-- ============================================================
-- MIGRATION 20261009000001: ENFORCE USER_ID OWNERSHIP & STATE MACHINE RULES
-- ============================================================

-- 1. Backfill any existing projects where user_id is null using auth.users email match
update public.projects p
set user_id = u.id
from auth.users u
where p.user_id is null and lower(p.email) = lower(u.email);

-- Ensure projects.user_id is strictly not null
alter table public.projects alter column user_id set not null;

-- Ensure orders.user_id is strictly not null
alter table public.orders alter column user_id set not null;

-- Ensure project_messages.sender_id is strictly not null
alter table public.project_messages alter column sender_id set not null;

-- 2. State Machine Rule: Unpaid projects cannot enter active production, review, or delivery
-- Update public.update_project_status to enforce payment requirement before production
create or replace function public.update_project_status(
  p_project_id text,
  p_new_status text,
  p_notes text default null,
  p_admin_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_caller_is_admin boolean;
  v_caller_id uuid;
begin
  v_caller_is_admin := public.is_admin();
  if not v_caller_is_admin then
    raise exception 'unauthorized_admin_required';
  end if;

  v_caller_id := coalesce(auth.uid(), p_admin_id);

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'project_not_found';
  end if;

  if v_project.status = p_new_status then
    return jsonb_build_object('success', true, 'status', p_new_status, 'unchanged', true);
  end if;

  if v_project.status in ('declined', 'cancelled') then
    raise exception 'cannot_transition_from_terminal_status';
  end if;

  if p_new_status not in ('pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered', 'declined', 'cancelled') then
    raise exception 'invalid_target_status';
  end if;

  -- ENFORCE: Unpaid projects CANNOT enter production, review round, or delivered
  if p_new_status in ('in_production', 'review_round', 'delivered') and v_project.payment_status != 'paid' then
    raise exception 'unpaid_project_cannot_enter_production';
  end if;

  update public.projects set
    status = p_new_status,
    updated_at = now()
  where id = p_project_id;

  insert into public.project_status_history (project_id, old_status, new_status, changed_by, reason)
  values (p_project_id, v_project.status, p_new_status, v_caller_id, p_notes);

  return jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'old_status', v_project.status,
    'new_status', p_new_status,
    'updated_at', now()
  );
end;
$$;

revoke execute on function public.update_project_status(text, text, text, uuid) from public, anon;
grant execute on function public.update_project_status(text, text, text, uuid) to authenticated, service_role;
