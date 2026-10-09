import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null, canChat: false }, { status: 200 });
    }
    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isAdmin: user.isAdmin,
          emailConfirmed: user.emailConfirmed,
          hasProjects: user.hasProjects,
          canChat: user.canChat,
        },
        canChat: user.canChat,
      },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Session check failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
