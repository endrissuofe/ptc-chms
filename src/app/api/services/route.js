import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { createServiceSchema, reorderServicesSchema } from '@/lib/validators/churchService';
import { listServices, createService, reorderServices } from '@/services/churchService.service';

/** Active services for everyone signed in. Admin: GET ?all=1 includes switched-off ones. */
export const GET = handler(async (req) => {
  const user = await requireRole();
  const all = new URL(req.url).searchParams.get('all') === '1' && user.role === ROLES.ADMIN;
  return NextResponse.json({ items: await listServices({ includeInactive: all }) });
});

/** Admin adds a service: { name, startTime: "HH:mm" } */
export const POST = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  const input = createServiceSchema.parse(await req.json());
  return NextResponse.json(await createService(input), { status: 201 });
});

/** Admin reorders services: { order: ["first", "second"] } */
export const PATCH = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  const { order } = reorderServicesSchema.parse(await req.json());
  return NextResponse.json({ items: await reorderServices(order) });
});
