import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { DEFAULT_SERVICE, serviceKeyFromName, sortServices } from '@/lib/church';
import { ChurchService } from '@/models';

const PUBLIC_FIELDS = 'key name startTime order active -_id';

/** Makes sure the church has at least one service. */
export async function ensureDefaultService() {
  await connectDB();
  if (!(await ChurchService.exists({}))) {
    await ChurchService.updateOne(
      { key: DEFAULT_SERVICE.key },
      { $setOnInsert: DEFAULT_SERVICE },
      { upsert: true },
    );
  }
}

/** Services in display order. Ushers only ever see active ones. */
export async function listServices({ includeInactive = false } = {}) {
  await ensureDefaultService();
  const filter = includeInactive ? {} : { active: true };
  return sortServices(await ChurchService.find(filter).select(PUBLIC_FIELDS).lean());
}

/** Throws 400 unless `key` is an active service. Used before saving attendance or visits. */
export async function requireActiveService(key) {
  await ensureDefaultService();
  if (!(await ChurchService.exists({ key, active: true }))) {
    throw new HttpError(400, 'Choose one of the church’s services');
  }
}

export async function createService({ name, startTime }) {
  await ensureDefaultService();
  const existing = await ChurchService.find().select('key order').lean();
  const service = await ChurchService.create({
    key: serviceKeyFromName(
      name,
      existing.map((s) => s.key),
    ),
    name,
    startTime,
    order: Math.max(0, ...existing.map((s) => s.order)) + 1,
  });
  const { key, order, active } = service;
  return { key, name: service.name, startTime: service.startTime, order, active };
}

export async function updateService(key, changes) {
  await connectDB();
  if (changes.active === false) {
    const othersActive = await ChurchService.countDocuments({ active: true, key: { $ne: key } });
    if (!othersActive) throw new HttpError(400, 'At least one service must stay active');
  }
  const service = await ChurchService.findOneAndUpdate({ key }, changes, {
    new: true,
    runValidators: true,
  })
    .select(PUBLIC_FIELDS)
    .lean();
  if (!service) throw new HttpError(404, 'Service not found');
  return service;
}

/** Saves a new display order. `order` must list every service key exactly once. */
export async function reorderServices(order) {
  await connectDB();
  const keys = (await ChurchService.find().select('key').lean()).map((s) => s.key);
  const sameSet = order.length === keys.length && keys.every((k) => order.includes(k));
  if (!sameSet) throw new HttpError(400, 'The order must list every service once');
  await ChurchService.bulkWrite(
    order.map((key, i) => ({ updateOne: { filter: { key }, update: { order: i + 1 } } })),
  );
  return listServices({ includeInactive: true });
}
