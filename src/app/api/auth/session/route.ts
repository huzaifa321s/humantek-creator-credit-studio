import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }
    return NextResponse.json({ authenticated: true, user: session }, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Session check failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
