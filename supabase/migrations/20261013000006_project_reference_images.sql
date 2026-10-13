-- Step 4 reference images (wizard "Reference Art & Files").
--
-- Private bucket: browsers upload with server-issued signed upload URLs and
-- view through short-lived signed URLs, so no public access or client-side
-- storage RLS policies are required.
--
-- Limits mirror REFERENCE_LIMITS in src/lib/validation.ts:
--   * 10 MB per image (enforced here by Supabase -> 413 if exceeded)
--   * PNG / JPG / WebP only (enforced here by Supabase -> 415 otherwise)
--   * 10 images and 50 MB per project (enforced by /api/uploads and /api/projects)
--
-- Layout: references/<projectId>/<uuid>-<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-references',
  'project-references',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
