import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { toServiceDate, dayFromIso, daysBetween } from '@/lib/dates';
import {
  DEFAULT_SERVICES,
  USHER_BACKDATE_DAYS,
  isHeldOn,
  serviceKeyFromName,
  servicesOn,
  sortServices,
} from '@/lib/church';
import { ChurchService } from '@/models';

const PUBLIC_FIELDS = 'key name kind days date startTime active -_id';

/** Makes sure the church has its default services (Sunday and midweek) on a fresh install. */
export async function ensureDefaultService() {
  await connectDB();
  if (!(await ChurchService.exists({}))) {
    await Promise.all(
      DEFAULT_SERVICES.map((s) =>
        ChurchService.updateOne({ key: s.key }, { $setOnInsert: s }, { upsert: true }),
      ),
    );
  }
}

/**
 * Services in start-time order.
 * @param {object} [opts]
 * @param {boolean} [opts.includeInactive]  admin list: also switched-off ones
 * @param {Date} [opts.on]  only services held on this service date
 */
export async function listServices({ includeInactive = false, on } = {}) {
  await ensureDefaultService();
  const filter = includeInactive ? {} : { active: true };
  const services = await ChurchService.find(filter).select(PUBLIC_FIELDS).lean();
  return on ? servicesOn(services, toServiceDate(on)) : sortServices(services);
}

/**
 * Checks a service before attendance or a visit is saved against it.
 * Everyone: the service must exist and be active.
 * Ushers: the date must be within the last USHER_BACKDATE_DAYS days (not in the future),
 * and the service must actually be held that day.
 */
export async function requireActiveService(key, serviceDate, user, today = new Date()) {
  await ensureDefaultService();
  const service = await ChurchService.findOne({ key, active: true }).lean();
  if (!service) throw new HttpError(400, 'Choose one of the church’s services');
  if (user?.role !== ROLES.USHER) return service;

  const day = toServiceDate(serviceDate);
  const age = daysBetween(day, toServiceDate(today));
  if (age < 0) throw new HttpError(400, 'That date hasn’t happened yet');
  if (age > USHER_BACKDATE_DAYS) {
    throw new HttpError(400, `Ushers can only enter the last ${USHER_BACKDATE_DAYS} days`);
  }
  if (!isHeldOn(service, day)) throw new HttpError(400, `${service.name} wasn’t held that day`);
  return service;
}

const canManage = (user, kind) =>
  !user || user.role === ROLES.ADMIN || (kind === 'special' && user.role === ROLES.PASTOR);

export async function createService(input, user) {
  if (!canManage(user, input.kind)) throw new HttpError(403, 'Only admins manage regular services');
  await ensureDefaultService();
  const taken = (await ChurchService.find().select('key').lean()).map((s) => s.key);
  const service = await ChurchService.create({
    key: serviceKeyFromName(input.name, taken),
    name: input.name,
    kind: input.kind,
    startTime: input.startTime,
    ...(input.kind === 'regular' ? { days: input.days } : { date: dayFromIso(input.date) }),
    createdBy: user?.id,
  });
  return ChurchService.findById(service._id).select(PUBLIC_FIELDS).lean();
}

export async function updateService(key, changes, user) {
  await ensureDefaultService();
  const current = await ChurchService.findOne({ key }).lean();
  if (!current) throw new HttpError(404, 'Service not found');
  if (!canManage(user, current.kind)) {
    throw new HttpError(403, 'Only admins manage regular services');
  }

  const update = { ...changes };
  if (current.kind === 'regular') {
    if ('date' in update) throw new HttpError(400, 'Regular services repeat on days, not a date');
  } else {
    if ('days' in update) throw new HttpError(400, 'Special services have a date, not days');
    if (update.date) update.date = dayFromIso(update.date);
  }
  if (update.active === false && current.kind === 'regular') {
    const othersActive = await ChurchService.countDocuments({
      kind: 'regular',
      active: true,
      key: { $ne: key },
    });
    if (!othersActive) throw new HttpError(400, 'At least one regular service must stay active');
  }

  return ChurchService.findOneAndUpdate({ key }, update, { new: true, runValidators: true })
    .select(PUBLIC_FIELDS)
    .lean();
}
