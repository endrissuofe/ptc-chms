import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { emailStatus } from '@/lib/email';
import { sendFollowUpReport } from '@/services/alerts.service';

export const dynamic = 'force-dynamic';

/**
 * Every morning, 7 AM Lagos (Vercel Cron, Authorization: Bearer <CRON_SECRET>):
 * the follow-up report — yesterday's first timers and anyone waiting over 72 hours.
 */
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const results = {};
  try {
    results.followUpReport = emailStatus().live
      ? await sendFollowUpReport()
      : { skipped: 'EMAIL_PROVIDER is mock' };
  } catch (err) {
    logger.error({ err }, 'Daily follow-up report failed');
    results.followUpReport = { error: 'failed' };
  }
  return NextResponse.json(results);
}
