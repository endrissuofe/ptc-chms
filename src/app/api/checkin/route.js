import { NextResponse } from 'next/server';
import { handler } from '@/lib/api';
import { checkInAnswerSchema } from '@/lib/validators/checkin';
import { answerCheckIn } from '@/services/checkin.service';

/** Public: a first timer answers their one-month check-in (the link is their key). */
export const POST = handler(async (req) => {
  const input = checkInAnswerSchema.parse(await req.json());
  return NextResponse.json(await answerCheckIn(input));
});
