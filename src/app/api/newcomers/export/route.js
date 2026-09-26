import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { isoDay } from '@/lib/dates';
import { peopleCsv } from '@/lib/export';
import { exportPeople } from '@/services/newcomer.service';

/** Pastor/admin: the First timers list as a CSV for Excel. GET ?view=all&q=... No prayer requests. */
export const GET = handler(async (req) => {
  await requireRole(ROLES.PASTOR, ROLES.ADMIN);
  const params = new URL(req.url).searchParams;
  const people = await exportPeople({
    view: params.get('view') || 'all',
    q: params.get('q') || undefined,
  });
  return new Response(peopleCsv(people), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="first-timers-${isoDay(new Date())}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
