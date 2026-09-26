import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { memberImportSchema } from '@/lib/validators/sms';
import { importMembers, previewImport } from '@/services/member.service';

/** Upload a member CSV: { csv, commit }. commit false only checks it; true saves it. */
export const POST = handler(async (req) => {
  const user = await requireRole(ROLES.ADMIN);
  const { csv, commit } = memberImportSchema.parse(await req.json());
  return NextResponse.json(commit ? await importMembers(csv, user) : await previewImport(csv));
});
