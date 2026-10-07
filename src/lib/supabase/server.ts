import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSafeSupabaseCredentials } from './config';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSafeSupabaseCredentials();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/**
 * Service Role client for trusted server-side operations (bypasses RLS, can execute SECURITY DEFINER RPCs).
 * NEVER expose this to client code.
 */
export function createAdminClient() {
  const { url } = getSafeSupabaseCredentials();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in server environment variables.');
  }
  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
