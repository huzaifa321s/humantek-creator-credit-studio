import { NextResponse } from 'next/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    if (isRealSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        await supabase.auth.signOut();
      } catch {
        // Silently handle if session is already expired
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
