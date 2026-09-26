import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { createServiceSchema } from '@/lib/validators/churchService';
import { listServices, createService } from '@/services/churchService.service';

const MANAGERS = [ROLES.ADMIN, ROLES.PASTOR];

/** Active services for everyone signed in. Admin/pastor: GET ?all=1 includes switched-off ones. */
export const GET = handler(async (req) => {
  const user = await requireRole();
  const all = new URL(req.url).searchParams.get('all') === '1' && MANAGERS.includes(user.role);
  return NextResponse.json({ items: await listServices({ includeInactive: all }) });
});

/**
 * Add a service. Admin: regular or special. Pastor: special only.
 * { kind: "regular", name, startTime: "HH:mm", days: [0, 3] }
 * { kind: "special", name, startTime: "HH:mm", date: "YYYY-MM-DD" }
 */
export const POST = handler(async (req) => {
  const user = await requireRole(...MANAGERS);
  const input = createServiceSchema.parse(await req.json());
  return NextResponse.json(await createService(input, user), { status: 201 });
});
