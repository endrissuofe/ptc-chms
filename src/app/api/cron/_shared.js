import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { runScheduledSend } from '@/services/sms.service';

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
    try {
      const result = await runScheduledSend(templateKey);
      return NextResponse.json(result);
    } catch (err) {
      logger.error({ err, templateKey }, 'Cron run failed');
      return NextResponse.json({ error: 'Cron run failed' }, { status: 500 });
    }
  };
}
