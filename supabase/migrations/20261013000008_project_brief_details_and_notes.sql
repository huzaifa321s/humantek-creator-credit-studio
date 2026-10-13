-- 20261013000008_project_brief_details_and_notes.sql
-- Add reference_links (strictly validated http/https links) and additional_notes (dated post-submission client additions)

alter table public.projects
  add column if not exists reference_links jsonb not null default '[]'::jsonb,
  add column if not exists additional_notes jsonb not null default '[]'::jsonb;
