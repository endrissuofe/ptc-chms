import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { CHURCH } from '@/lib/church-profile';
import { isHeldOn } from '@/lib/church';
import { addDays, dayFromIso, isoDay } from '@/lib/dates';
import { itemRef, parseRef, plannedItems, weekStart } from '@/lib/media';
import { postTexts, serviceTexts, youtubeTexts } from '@/lib/media-captions';
import { ChurchService, MediaItem, MediaSettings, ServiceDay } from '@/models';
import { ensureDefaultService } from './churchService.service';
import { listCelebrations } from './celebration.service';

/** The Media screen: the week's list, what each service is about, and the brand kit. */

const BRAND_FIELDS = ['address', 'facebook', 'instagram', 'youtube', 'hashtags', 'signoff'];
const ABOUT_FIELDS = ['theme', 'preacher', 'bibleText', 'youtubeUrl'];

const pick = (doc, fields) => Object.fromEntries(fields.map((f) => [f, doc?.[f] ?? '']));
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function getBrandKit() {
  await connectDB();
  const doc = await MediaSettings.findOneAndUpdate(
    { key: 'media' },
    { $setOnInsert: { key: 'media' } },
    { upsert: true, new: true },
  ).lean();
  return { ...pick(doc, BRAND_FIELDS), hashtags: doc.hashtags ?? [] };
}

export async function updateBrandKit(changes, user) {
  await connectDB();
  await MediaSettings.updateOne(
    { key: 'media' },
    { $set: { ...changes, updatedBy: user?.id } },
    { upsert: true },
  );
  return getBrandKit();
}

/** True until the team has filled in at least where the church meets or one social account. */
export const brandKitEmpty = (brand) =>
  !brand.address && !brand.facebook && !brand.instagram && !brand.youtube;

const serviceDayKey = (service, date) => `${service}|${isoDay(date)}`;

/**
 * The list for one week (Monday to Sunday), grouped by day, with ready-made text for each item.
 * @param {object} [opts]
 * @param {'this'|'next'} [opts.week]
 */
export async function getMediaWeek({ week = 'this', today = new Date() } = {}) {
  await ensureDefaultService();
  const monday = addDays(weekStart(today), week === 'next' ? 7 : 0);
  const end = addDays(monday, 7);

  const services = await ChurchService.find({ active: true })
    .select('key name kind days date startTime active livestream createdAt')
    .lean();
  const planned = plannedItems(services, monday);

  const [brand, celebrationDays, posts, about] = await Promise.all([
    getBrandKit(),
    listCelebrations({ from: monday, days: 7 }),
    MediaItem.find({ kind: 'post', date: { $gte: monday, $lt: end } })
      .sort({ createdAt: 1 })
      .lean(),
    ServiceDay.find({
      serviceDate: { $gte: monday, $lt: addDays(end, 7) },
    }).lean(),
  ]);
  const aboutFor = new Map(about.map((d) => [serviceDayKey(d.service, d.serviceDate), d]));

  const celebrations = celebrationDays
    .filter((d) => d.people.length)
    .map((d) => ({
      ref: itemRef.celebrations(dayFromIso(d.date)),
      kind: 'celebrations',
      date: dayFromIso(d.date),
      people: d.people.map((p) => ({ name: p.name, kind: p.kind })),
    }));

  const refs = [...planned, ...celebrations].map((i) => i.ref);
  const saved = await MediaItem.find({ ref: { $in: refs } })
    .populate('postedBy', 'displayName')
    .lean();
  const savedFor = new Map(saved.map((s) => [s.ref, s]));
  const church = { name: CHURCH.name };

  const status = (doc) => ({
    status: doc?.status ?? 'todo',
    postedAt: doc?.postedAt ?? null,
    postedBy: doc?.postedBy?.displayName ?? null,
  });

  const items = [
    ...planned.map((p) => {
      const detail = pick(aboutFor.get(serviceDayKey(p.service.key, p.serviceDate)), ABOUT_FIELDS);
      const args = { service: p.service, serviceDate: p.serviceDate, about: detail, brand, church };
      return {
        ref: p.ref,
        kind: p.kind,
        date: isoDay(p.date),
        title: p.service.name,
        service: { key: p.service.key, name: p.service.name, startTime: p.service.startTime },
        serviceDate: isoDay(p.serviceDate),
        about: detail,
        texts: p.kind === 'livestream' ? youtubeTexts(args) : serviceTexts(args),
        ...status(savedFor.get(p.ref)),
      };
    }),
    ...celebrations.map((c) => ({
      ref: c.ref,
      kind: c.kind,
      date: isoDay(c.date),
      title:
        c.people.length === 1 ? '1 person celebrating' : `${c.people.length} people celebrating`,
      people: c.people,
      ...status(savedFor.get(c.ref)),
    })),
    ...(await MediaItem.populate(posts, { path: 'postedBy', select: 'displayName' })).map((p) => ({
      ref: p.ref,
      kind: 'post',
      date: isoDay(p.date),
      title: p.title,
      details: p.details,
      texts: postTexts({ title: p.title, details: p.details, brand, church }),
      ...status(p),
    })),
  ];

  const order = { celebrations: 0, announcement: 1, livestream: 2, post: 3 };
  const days = Array.from({ length: 7 }, (_, i) => isoDay(addDays(monday, i))).map((date) => ({
    date,
    items: items
      .filter((it) => it.date === date)
      .sort((a, b) => order[a.kind] - order[b.kind] || a.title.localeCompare(b.title)),
  }));
  const counts = { todo: 0, ready: 0, posted: 0 };
  for (const it of items) counts[it.status] += 1;

  return { monday: isoDay(monday), days, counts, total: items.length, brand };
}

/** Moves an item to To do, Ready or Posted. Items the app lists are saved the first time. */
export async function setItemStatus({ ref, status }, user) {
  await ensureDefaultService();
  const parsed = parseRef(ref);
  if (!parsed) throw new HttpError(400, 'Not an item on the list');

  const set = { status, updatedBy: user?.id };
  const unset = {};
  if (status === 'posted') Object.assign(set, { postedAt: new Date(), postedBy: user?.id });
  else Object.assign(unset, { postedAt: '', postedBy: '' });
  const update = { $set: set, ...(Object.keys(unset).length && { $unset: unset }) };

  if (parsed.kind === 'post') {
    const doc = await MediaItem.findOneAndUpdate({ ref }, update, { new: true }).lean();
    if (!doc) throw new HttpError(404, 'That post has been removed');
    return { ref, status: doc.status };
  }
  if (parsed.service && !(await ChurchService.exists({ key: parsed.service }))) {
    throw new HttpError(404, 'Service not found');
  }
  const doc = await MediaItem.findOneAndUpdate(
    { ref },
    {
      ...update,
      $setOnInsert: { ref, kind: parsed.kind, date: parsed.serviceDate ?? parsed.date },
    },
    { new: true, upsert: true },
  ).lean();
  return { ref, status: doc.status };
}

export async function createQuickPost({ date, title, details }, user) {
  await connectDB();
  const _id = new mongoose.Types.ObjectId();
  const doc = await MediaItem.create({
    _id,
    ref: itemRef.post(_id),
    kind: 'post',
    date: dayFromIso(date),
    title,
    details,
    createdBy: user?.id,
  });
  return { ref: doc.ref, date: isoDay(doc.date), title: doc.title };
}

export async function deleteQuickPost(ref) {
  await connectDB();
  if (parseRef(ref)?.kind !== 'post') throw new HttpError(400, 'Only quick posts can be removed');
  const { deletedCount } = await MediaItem.deleteOne({ ref, kind: 'post' });
  if (!deletedCount) throw new HttpError(404, 'That post has already been removed');
  return { ref };
}

/** Saves what a service is about on one date. Fields left out stay as they are. */
export async function saveServiceDay({ service, date, ...fields }, user) {
  await ensureDefaultService();
  const serviceDate = dayFromIso(date);
  const found = await ChurchService.findOne({ key: service }).lean();
  if (!found) throw new HttpError(404, 'Service not found');
  if (!isHeldOn({ ...found, active: true }, serviceDate)) {
    throw new HttpError(400, `${found.name} isn’t held that day`);
  }
  const doc = await ServiceDay.findOneAndUpdate(
    { service, serviceDate },
    { $set: { ...fields, updatedBy: user?.id } },
    { upsert: true, new: true, runValidators: true },
  ).lean();
  return { service, date, ...pick(doc, ABOUT_FIELDS) };
}

/**
 * Past and coming services with something filled in, newest first: the sermon list.
 * `q` searches theme, preacher and Bible text.
 */
export async function listSermons({ q = '', limit = 100 } = {}) {
  await connectDB();
  const filled = {
    $or: ABOUT_FIELDS.map((f) => ({ [f]: { $nin: ['', null] } })),
  };
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const filter = words.length
    ? {
        $and: [
          filled,
          ...words.map((w) => {
            const rx = new RegExp(escapeRx(w), 'i');
            return { $or: [{ theme: rx }, { preacher: rx }, { bibleText: rx }] };
          }),
        ],
      }
    : filled;
  const [days, services] = await Promise.all([
    ServiceDay.find(filter).sort({ serviceDate: -1 }).limit(limit).lean(),
    ChurchService.find().select('key name').lean(),
  ]);
  const names = new Map(services.map((s) => [s.key, s.name]));
  return days.map((d) => ({
    service: d.service,
    serviceName: names.get(d.service) ?? d.service,
    date: isoDay(d.serviceDate),
    ...pick(d, ABOUT_FIELDS),
  }));
}
