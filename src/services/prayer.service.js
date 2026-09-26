import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { PrayerRequest } from '@/models';

/**
 * Prayer requests. Only the prayer team, pastors and admins may call these — never ushers or
 * follow-up workers. Callers check the role first.
 */
export const PRAYER_STATUSES = {
  new: { label: 'New', icon: 'notifications' },
  prayed: { label: 'Prayed for', icon: 'check_circle' },
  needs_visit: { label: 'Needs a visit', icon: 'home_pin' },
};

/** A tab of requests (newest first) and how many are in each tab. */
export async function listPrayerRequests({ status = 'new', limit = 100 } = {}) {
  await connectDB();
  const filter = status === 'all' ? {} : { status };
  const [items, counts] = await Promise.all([
    PrayerRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('person', 'firstName lastName phone stage')
      .populate('updatedBy', 'displayName')
      .lean(),
    PrayerRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  return {
    items,
    counts: {
      new: byStatus.new || 0,
      prayed: byStatus.prayed || 0,
      needs_visit: byStatus.needs_visit || 0,
      all: counts.reduce((sum, c) => sum + c.count, 0),
    },
  };
}

export async function setPrayerStatus(id, status, user) {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Prayer request not found');
  const doc = await PrayerRequest.findByIdAndUpdate(
    id,
    { status, updatedBy: user.id },
    { new: true },
  ).lean();
  if (!doc) throw new HttpError(404, 'Prayer request not found');
  return doc;
}

export async function countNewPrayerRequests() {
  await connectDB();
  return PrayerRequest.countDocuments({ status: 'new' });
}
