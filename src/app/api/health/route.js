import { NextResponse } from 'next/server';
import { pingDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Used by Docker healthchecks and uptime monitors. No sign-in needed; reveals nothing private. */
export async function GET() {
  const started = Date.now();
  let database = 'down';
  try {
    database = (await pingDB()) ? 'up' : 'down';
  } catch {
    database = 'down';
  }
  const ok = database === 'up';
  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
      responseMs: Date.now() - started,
    },
    { status: ok ? 200 : 503 },
  );
}
