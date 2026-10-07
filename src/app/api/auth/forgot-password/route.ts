import { NextRequest, NextResponse } from 'next/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const userEmail = rawEmail.trim().toLowerCase();

    if (!userEmail || !userEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (isRealSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        await admin.auth.resetPasswordForEmail(userEmail);
      } catch {
        // Silently catch to prevent user enumeration
      }
    }

    return NextResponse.json({
      ok: true,
      message:
        'If an account exists with that email, password reset instructions have been sent.',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Request failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
