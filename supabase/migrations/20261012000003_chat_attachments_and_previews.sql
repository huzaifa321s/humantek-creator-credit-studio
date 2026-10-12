-- 1. Private bucket for project chat attachments.
-- Files are uploaded by the server (service role) and read through short-lived signed URLs,
-- so no public access or client-side storage policies are needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-attachments',
  'project-attachments',
  false,
  52428800,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm',
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'application/vnd.adobe.photoshop', 'application/illustrator'
  ]
)
on conflict (id) do nothing;

-- 2. Readable inbox previews.
-- Message bodies with replies/edits are stored as a JSON envelope ({"v":1,"text":...}),
-- and image-only messages have an empty body. Store the plain text (or "Sent an image").
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
    null;
  end;

  return new;
end;
$$;

revoke execute on function public.notify_new_message from public, anon, authenticated;
grant execute on function public.notify_new_message to service_role;
