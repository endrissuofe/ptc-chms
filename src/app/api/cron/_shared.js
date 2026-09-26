import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { runScheduledSend, smsStatus } from '@/services/sms.service';

/**
 * Shared by the two cron routes. Vercel Cron (or a server crontab/curl) calls these with
 *   Authorization: Bearer <CRON_SECRET>
 * Anyone without the secret gets 401.
 */
export function cronRoute(templateKey) {
  return async function GET(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // With the mock provider nothing really goes out, so don't run: it would mark people as
    // already messaged and they'd be skipped once SMS goes live.
    if (!smsStatus().live) {
      return NextResponse.json({ templateKey, skipped: true, reason: 'SMS provider is mock' });
    }
    try {
      const result = await runScheduledSend(templateKey);
      return NextResponse.json(result);
    } catch (err) {
      logger.error({ err, templateKey }, 'Cron run failed');
      return NextResponse.json({ error: 'Cron run failed' }, { status: 500 });
    }
  };
}
