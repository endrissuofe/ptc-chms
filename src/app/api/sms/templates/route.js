import { NextResponse } from 'next/server';
import { handler, requireRole, HttpError } from '@/lib/api';
import { connectDB } from '@/lib/db';
import { ROLES } from '@/lib/roles';
import { smsTemplateSchema } from '@/lib/validators/followup';
import { ensureTemplates } from '@/services/sms.service';
import { SmsTemplate } from '@/models';

export const GET = handler(async () => {
  await requireRole(ROLES.ADMIN, ROLES.PASTOR);
  await ensureTemplates();
  return NextResponse.json({ items: await SmsTemplate.find().sort({ key: 1 }).lean() });
});

/** PATCH ?key=sunday_thanks { body, enabled } */
export const PATCH = handler(async (req) => {
  const user = await requireRole(ROLES.ADMIN);
  await connectDB();
  const key = new URL(req.url).searchParams.get('key');
  const input = smsTemplateSchema.parse(await req.json());
  const doc = await SmsTemplate.findOneAndUpdate(
    { key },
    { ...input, updatedBy: user.id },
    { new: true },
  ).lean();
  if (!doc) throw new HttpError(404, 'Template not found');
  return NextResponse.json(doc);
});
