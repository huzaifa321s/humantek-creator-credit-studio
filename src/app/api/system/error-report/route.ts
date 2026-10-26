import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { reportStudioError } from '@/lib/error-reporter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';
    const rl = checkRateLimit(`client-err:${ip}`, 10, 5 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, rateLimited: true }, { status: 429 });
    }

    const user = await getRequestUser().catch(() => null);
    const body = await req.json().catch(() => ({}));

    const message =
      typeof body?.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 600)
        : 'Unexpected client runtime error';
    const area =
      typeof body?.area === 'string' && body.area.trim()
        ? body.area.trim().slice(0, 120)
        : 'Client UI Crash';
    const route =
      typeof body?.route === 'string' && body.route.trim()
        ? body.route.trim().slice(0, 240)
        : req.headers.get('referer') || 'Browser Client';
    const stack =
      typeof body?.stack === 'string' ? body.stack.slice(0, 2000) : undefined;
    const digest =
      typeof body?.digest === 'string' ? body.digest.slice(0, 100) : undefined;
    const clientEmail =
      typeof body?.clientEmail === 'string' ? body.clientEmail.trim() : undefined;
    const clientName =
      typeof body?.clientName === 'string' ? body.clientName.trim() : undefined;
    const rawContext =
      body?.context && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : {};

    const userAgent = req.headers.get('user-agent') || undefined;

    await reportStudioError({
      area,
      route,
      severity: body?.severity === 'CRITICAL' ? 'CRITICAL' : 'ERROR',
      error: {
        message,
        code: digest,
        stack,
      },
      user,
      clientEmail,
      clientName,
      context: {
        ...rawContext,
        ...(userAgent ? { browserUserAgent: userAgent.slice(0, 180) } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
