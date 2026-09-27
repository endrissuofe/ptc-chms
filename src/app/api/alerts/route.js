import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { alertSettingsSchema } from '@/lib/validators/alerts';
import { previewFollowUpReport, updateAlertSettings } from '@/services/alerts.service';

/** Admins: who gets the alert emails, and what the next morning report would say. */
export const GET = handler(async () => {
  await requireRole(ROLES.ADMIN);
  return NextResponse.json(await previewFollowUpReport());
});

export const PATCH = handler(async (req) => {
  const user = await requireRole(ROLES.ADMIN);
  const input = alertSettingsSchema.parse(await req.json());
  return NextResponse.json(await updateAlertSettings(input, user));
});
