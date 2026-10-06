import { createBrowserClient } from '@supabase/ssr';
import { getSafeSupabaseCredentials } from './config';

export function createClient() {
  const { url, key } = getSafeSupabaseCredentials();
  return createBrowserClient(url, key);
}
