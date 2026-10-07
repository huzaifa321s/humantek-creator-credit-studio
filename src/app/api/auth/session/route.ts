import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }
    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isAdmin: user.isAdmin,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Session check failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
