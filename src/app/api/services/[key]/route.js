import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { updateServiceSchema } from '@/lib/validators/churchService';
import { updateService } from '@/services/churchService.service';

/**
 * Change a service: { name?, startTime?, active?, days? (regular), date? (special) }.
 * Admin: any service. Pastor: special services only (checked in the service layer).
 */
export const PATCH = handler(async (req, { params }) => {
  const user = await requireRole(ROLES.ADMIN, ROLES.PASTOR);
  const { key } = await params;
  const changes = updateServiceSchema.parse(await req.json());
  return NextResponse.json(await updateService(key, changes, user));
});
