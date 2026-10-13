import { redirect } from 'next/navigation';

interface ProjectDetailRedirectPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /projects/[id]
 *
 * Permanent, stable canonical public URL for project details.
 * Currently performs a clean HTTP 307 temporary redirect to the interactive
 * URL-addressable drawer (?project=<id>), while preserving any additional
 * query parameters (e.g. section=files, tab, etc.).
 *
 * In the future, if project details are promoted to a standalone multi-tab page,
 * this URL remains 100% stable without breaking any notifications, emails, or bookmarks.
 */
export default async function ProjectDetailRedirectPage({
  params,
  searchParams,
}: ProjectDetailRedirectPageProps) {
  const { id } = await params;
  const sParams = (await searchParams) || {};

  const query = new URLSearchParams();
  query.set('project', id);

  for (const [key, value] of Object.entries(sParams)) {
    if (key !== 'project' && typeof value === 'string' && value.trim()) {
      query.set(key, value.trim());
    }
  }

  // Next.js redirect() issues an HTTP 307 Temporary Redirect by default
  redirect(`/projects?${query.toString()}`);
}
