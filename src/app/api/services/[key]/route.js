import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { updateServiceSchema } from '@/lib/validators/churchService';
import { updateService } from '@/services/churchService.service';

/** Admin renames, retimes, or switches a service on/off: { name?, startTime?, active? } */
export const PATCH = handler(async (req, { params }) => {
  await requireRole(ROLES.ADMIN);
  const { key } = await params;
  const changes = updateServiceSchema.parse(await req.json());
  return NextResponse.json(await updateService(key, changes));
});
