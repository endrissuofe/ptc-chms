import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { connectDB } from '@/lib/db';
import { ROLES } from '@/lib/roles';
import { smsTemplateSchema } from '@/lib/validators/sms';
import { ensureTemplates, updateTemplate } from '@/services/sms.service';
import { SmsTemplate } from '@/models';

export const GET = handler(async () => {
  await requireRole(ROLES.ADMIN, ROLES.PASTOR);
  await ensureTemplates();
  await connectDB();
  return NextResponse.json({ items: await SmsTemplate.find().sort({ key: 1 }).lean() });
});

/** PATCH ?key=sunday_thanks { body, enabled } */
export const PATCH = handler(async (req) => {
  const user = await requireRole(ROLES.ADMIN);
  const key = new URL(req.url).searchParams.get('key');
  const input = smsTemplateSchema.parse(await req.json());
  return NextResponse.json(await updateTemplate(key, input, user));
});
