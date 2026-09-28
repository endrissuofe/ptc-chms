import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { runSaturdayInvites, smsStatus } from '@/services/sms.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Saturdays 12 noon Lagos (Vercel Cron, Authorization: Bearer <CRON_SECRET>): invite recent
 * first and second timers, and members, to church tomorrow, in this week's wording.
 */
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // With the mock provider nothing really goes out, so don't mark anyone as messaged.
  if (!smsStatus().live) return NextResponse.json({ skipped: 'SMS provider is mock' });
  try {
    return NextResponse.json(await runSaturdayInvites());
  } catch (err) {
    logger.error({ err }, 'Saturday invites failed');
    return NextResponse.json({ error: 'Saturday invites failed' }, { status: 500 });
  }
}
