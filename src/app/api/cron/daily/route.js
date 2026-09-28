import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { emailStatus } from '@/lib/email';
import { smsStatus } from '@/services/sms.service';
import { sendFollowUpReport } from '@/services/alerts.service';
import { sendCelebrationSms, sendCelebrationsEmail } from '@/services/celebration.service';
import { sendCheckIns } from '@/services/checkin.service';
import { weekOf } from '@/services/sms.service';
import { draftWeek } from '@/services/sms-draft.service';
import { addDays, toServiceDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Every morning, 7 AM Lagos (Vercel Cron, Authorization: Bearer <CRON_SECRET>):
 *   - Fridays: the AI writer drafts next week's SMS wording (Saturdays: fills any gaps first)
 *   - the follow-up report (new first timers, anyone waiting over 72 hours)
 *   - birthday and wedding anniversary SMS
 *   - the celebrations email for the admin / media team
 *   - the one-month check-in SMS (a survey link) for first timers
 * Each part runs even if another fails, and each is safe to run twice.
 */
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const emailOn = emailStatus().live;
  const weekday = toServiceDate().getUTCDay();
  const jobs = {
    // First, so a Saturday's messages already use the new week's wording.
    smsDrafts: () =>
      weekday === 5 || weekday === 6
        ? draftWeek({ saturday: weekOf(addDays(new Date(), 1)) })
        : { skipped: 'only on Fridays and Saturdays' },
    followUpReport: () => (emailOn ? sendFollowUpReport() : { skipped: 'EMAIL_PROVIDER is mock' }),
    // With the mock SMS provider nothing really goes out, so don't mark anyone as wished.
    celebrationSms: () =>
      smsStatus().live ? sendCelebrationSms() : { skipped: 'SMS provider is mock' },
    celebrationsEmail: () =>
      emailOn ? sendCelebrationsEmail() : { skipped: 'EMAIL_PROVIDER is mock' },
    checkInSms: () => (smsStatus().live ? sendCheckIns() : { skipped: 'SMS provider is mock' }),
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
