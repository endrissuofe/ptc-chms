import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { emailStatus } from '@/lib/email';
import { smsStatus } from '@/services/sms.service';
import { sendFollowUpReport } from '@/services/alerts.service';
import { sendCelebrationSms, sendCelebrationsEmail } from '@/services/celebration.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Every morning, 7 AM Lagos (Vercel Cron, Authorization: Bearer <CRON_SECRET>):
 *   - the follow-up report (new first timers, anyone waiting over 72 hours)
 *   - birthday and wedding anniversary SMS
 *   - the celebrations email for the admin / media team
 * Each part runs even if another fails, and each is safe to run twice.
 */
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const emailOn = emailStatus().live;
  const jobs = {
    followUpReport: () => (emailOn ? sendFollowUpReport() : { skipped: 'EMAIL_PROVIDER is mock' }),
    // With the mock SMS provider nothing really goes out, so don't mark anyone as wished.
    celebrationSms: () =>
      smsStatus().live ? sendCelebrationSms() : { skipped: 'SMS provider is mock' },
    celebrationsEmail: () =>
      emailOn ? sendCelebrationsEmail() : { skipped: 'EMAIL_PROVIDER is mock' },
  };
  const results = {};
  for (const [name, run] of Object.entries(jobs)) {
    try {
      results[name] = await run();
    } catch (err) {
      logger.error({ err, job: name }, 'Daily job failed');
      results[name] = { error: 'failed' };
    }
  }
  return NextResponse.json(results);
}
