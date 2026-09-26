import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { Person, FollowUp } from '@/models';

/** Logs a call or visit and marks the person as contacted. */
export async function logFollowUp(input, user) {
  await connectDB();
  const person = await Person.findById(input.personId);
  if (!person) throw new HttpError(404, 'Person not found');

  const entry = await FollowUp.create({
    person: person._id,
    worker: user.id,
    outcome: input.outcome,
    channel: input.channel,
    note: input.note,
  });

  if (input.outcome === 'reached') {
    person.lastContactAt = new Date();
    await person.save();
  }
  return entry.toObject();
}
