-- Migration: Project uploads tracking table, cron runs history, and storage policies
-- Creates public.project_uploads and public.cron_runs

-- 1. Project Uploads Table
create table if not exists public.project_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id text not null,
  project_id text references public.projects(id) on delete set null,
  storage_path text not null unique,
  filename text not null,
  size bigint not null check (size > 0),
  mime_type text not null,
  status text not null default 'pending' check (status in ('pending', 'attached')),
  created_at timestamptz not null default now(),
  attached_at timestamptz
);

-- Fast lookup indexes
create index if not exists idx_project_uploads_user_draft on public.project_uploads (user_id, draft_id, status);
create index if not exists idx_project_uploads_pending_created on public.project_uploads (status, created_at);
create index if not exists idx_project_uploads_project_id on public.project_uploads (project_id);
create index if not exists idx_project_uploads_user_created on public.project_uploads (user_id, created_at);

-- Enable RLS
alter table public.project_uploads enable row level security;

-- Client RLS: Users can view and delete their own pending uploads
drop policy if exists "Users can view own uploads" on public.project_uploads;
create policy "Users can view own uploads"
  on public.project_uploads
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own pending uploads" on public.project_uploads;
create policy "Users can delete own pending uploads"
  on public.project_uploads
  for delete
  to authenticated
  using (auth.uid() = user_id and status = 'pending');

-- Admin RLS: Admins can view all uploads
drop policy if exists "Admins can view all uploads" on public.project_uploads;
create policy "Admins can view all uploads"
  on public.project_uploads
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 2. Cron Runs Table (Track every execution and detect missed schedules)
create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null default 'cleanup_references',
  status text not null check (status in ('success', 'failed')),
  scanned integer not null default 0,
  removed_files integer not null default 0,
  removed_bytes bigint not null default 0,
  dry_run boolean not null default false,
  error text,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_cron_runs_job_created on public.cron_runs (job_name, created_at desc);

alter table public.cron_runs enable row level security;

drop policy if exists "Admins can view cron runs" on public.cron_runs;
create policy "Admins can view cron runs"
  on public.cron_runs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 3. Ensure project-references bucket exists and has correct private config (no SVG)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-references',
  'project-references',
  false,
  10485760, -- 10 MB per file
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
