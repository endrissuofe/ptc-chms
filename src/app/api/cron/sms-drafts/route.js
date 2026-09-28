import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { addDays } from '@/lib/dates';
import { weekOf } from '@/services/sms.service';
import { draftWeek } from '@/services/sms-draft.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Drafts the AI wording now, outside the Friday run: ?week=this (default) or ?week=next.
 * Only fills messages with no draft yet. Needs Authorization: Bearer <CRON_SECRET>.
 * Not scheduled on its own: the daily job drafts on Fridays (and fills gaps on Saturdays).
 */
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const next = new URL(req.url).searchParams.get('week') === 'next';
  try {
    const saturday = next ? addDays(weekOf(), 7) : weekOf();
    return NextResponse.json(await draftWeek({ saturday }));
  } catch (err) {
    logger.error({ err }, 'SMS drafts failed');
    return NextResponse.json({ error: 'SMS drafts failed' }, { status: 500 });
  }
}
