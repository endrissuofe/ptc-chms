import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** The Media screen against a throwaway in-memory MongoDB. */
let mongod;
let media;
let churchSvc;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_media_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  media = await import('@/services/media.service');
  churchSvc = await import('@/services/churchService.service');
  models = await import('@/models');
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all(Object.values(models).map((m) => m.deleteMany({})));
});

const admin = { id: undefined, role: 'admin' };
// Tuesday 29 Sept 2026: this week is Mon 28 Sept to Sun 4 Oct.
const today = new Date('2026-09-29T09:00:00Z');
const itemsOf = (week) => week.days.flatMap((d) => d.items);

describe('media week', () => {
  it('lists the default services’ announcements and the Sunday live, all to do', async () => {
    const week = await media.getMediaWeek({ today });
    expect(week.monday).toBe('2026-09-28');
    expect(week.days).toHaveLength(7);
    expect(itemsOf(week).map((i) => [i.ref, i.date, i.status])).toEqual([
      ['announcement:midweek:2026-09-30', '2026-09-29', 'todo'],
      ['announcement:sunday:2026-10-04', '2026-10-03', 'todo'],
      ['livestream:sunday:2026-10-04', '2026-10-04', 'todo'],
    ]);
    expect(week.counts).toEqual({ todo: 3, ready: 0, posted: 0 });
  });

  it('fills the texts from what the service is about and the brand kit', async () => {
    await media.updateBrandKit({ address: '12 Palm Avenue', hashtags: ['Faith'] }, admin);
    await media.saveServiceDay(
      { service: 'sunday', date: '2026-10-04', theme: 'Walking in Favour', preacher: 'Pastor Ade' },
      admin,
    );
    const items = itemsOf(await media.getMediaWeek({ today }));
    const announcement = items.find((i) => i.ref === 'announcement:sunday:2026-10-04');
    expect(announcement.texts.whatsapp).toContain('Theme: *Walking in Favour*');
    expect(announcement.texts.whatsapp).toContain('📍 12 Palm Avenue');
    expect(announcement.texts.facebook).toMatch(/#Faith$/);
    const live = items.find((i) => i.kind === 'livestream');
    expect(live.texts.title).toBe('Sunday Service · Walking in Favour · 4 Oct 2026');
    expect(live.about.preacher).toBe('Pastor Ade');
  });

  it('saves a status the first time it changes, and who posted it', async () => {
    const me = await models.User.create({
      username: 'media',
      displayName: 'Media Team',
      role: 'media',
      passwordHash: 'x',
    });
    const ref = 'announcement:sunday:2026-10-04';
    await media.setItemStatus({ ref, status: 'posted' }, { id: me._id, role: 'media' });
    let item = itemsOf(await media.getMediaWeek({ today })).find((i) => i.ref === ref);
    expect(item).toMatchObject({ status: 'posted', postedBy: 'Media Team' });

    await media.setItemStatus({ ref, status: 'ready' }, admin);
    item = itemsOf(await media.getMediaWeek({ today })).find((i) => i.ref === ref);
    expect(item).toMatchObject({ status: 'ready', postedBy: null, postedAt: null });
    expect(await models.MediaItem.countDocuments()).toBe(1);
  });

  it('refuses statuses for made-up items', async () => {
    await expect(
      media.setItemStatus({ ref: 'nonsense', status: 'posted' }, admin),
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      media.setItemStatus({ ref: 'announcement:nope:2026-10-04', status: 'posted' }, admin),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      media.setItemStatus({ ref: 'post:0123456789abcdef01234567', status: 'posted' }, admin),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('adds and removes quick posts', async () => {
    const post = await media.createQuickPost(
      { date: '2026-10-01', title: 'Choir rehearsal moved', details: 'Friday at 5 PM.' },
      admin,
    );
    let item = itemsOf(await media.getMediaWeek({ today })).find((i) => i.ref === post.ref);
    expect(item).toMatchObject({ kind: 'post', date: '2026-10-01', status: 'todo' });
    expect(item.texts.whatsapp).toContain('*Choir rehearsal moved*');

    await media.setItemStatus({ ref: post.ref, status: 'posted' }, admin);
    item = itemsOf(await media.getMediaWeek({ today })).find((i) => i.ref === post.ref);
    expect(item.status).toBe('posted');

    await media.deleteQuickPost(post.ref);
    expect(itemsOf(await media.getMediaWeek({ today })).some((i) => i.ref === post.ref)).toBe(
      false,
    );
    await expect(media.deleteQuickPost(post.ref)).rejects.toMatchObject({ status: 404 });
    await expect(media.deleteQuickPost('announcement:sunday:2026-10-04')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('shows next week, with a special service announced 7 days ahead', async () => {
    await churchSvc.createService(
      { kind: 'special', name: 'Thanksgiving Service', startTime: '10:00', date: '2026-10-10' },
      admin,
    );
    const thisWeek = itemsOf(await media.getMediaWeek({ today }));
    expect(thisWeek.find((i) => i.service?.key === 'thanksgiving-service')).toMatchObject({
      kind: 'announcement',
      date: '2026-10-03',
      serviceDate: '2026-10-10',
    });
    const next = itemsOf(await media.getMediaWeek({ today, week: 'next' }));
    expect(
      next.filter((i) => i.service?.key === 'thanksgiving-service').map((i) => i.kind),
    ).toEqual(['livestream']);
  });

  it('adds birthdays to the list', async () => {
    await models.Member.create({
      firstName: 'Bola',
      lastName: 'Ade',
      phone: '+2348060000999',
      birthDay: 1,
      birthMonth: 10,
    });
    const item = itemsOf(await media.getMediaWeek({ today })).find(
      (i) => i.kind === 'celebrations',
    );
    expect(item).toMatchObject({
      ref: 'celebrations:2026-10-01',
      date: '2026-10-01',
      title: '1 person celebrating',
      people: [{ name: 'Bola Ade', kind: 'birthday' }],
    });
    await media.setItemStatus({ ref: item.ref, status: 'posted' }, admin);
  });
});

describe('service details and sermons', () => {
  it('only saves details for a day the service is held', async () => {
    await expect(
      media.saveServiceDay({ service: 'sunday', date: '2026-10-05', theme: 'x' }, admin),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      media.saveServiceDay({ service: 'nope', date: '2026-10-04', theme: 'x' }, admin),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('keeps fields not sent, and lists and searches sermons newest first', async () => {
    await media.saveServiceDay({ service: 'sunday', date: '2026-09-27', theme: 'Grace' }, admin);
    await media.saveServiceDay(
      { service: 'sunday', date: '2026-09-27', youtubeUrl: 'https://youtu.be/abc' },
      admin,
    );
    await media.saveServiceDay(
      { service: 'midweek', date: '2026-09-30', preacher: 'Pastor Ade', bibleText: 'John 3:16' },
      admin,
    );
    await media.saveServiceDay({ service: 'sunday', date: '2026-10-04', theme: '' }, admin);

    const all = await media.listSermons();
    expect(all.map((s) => [s.serviceName, s.date])).toEqual([
      ['Midweek Service', '2026-09-30'],
      ['Sunday Service', '2026-09-27'],
    ]);
    expect(all[1]).toMatchObject({ theme: 'Grace', youtubeUrl: 'https://youtu.be/abc' });
    expect((await media.listSermons({ q: 'ade john' })).map((s) => s.date)).toEqual(['2026-09-30']);
    expect(await media.listSermons({ q: '.*' })).toEqual([]);
  });
});

describe('services on YouTube', () => {
  it('streams Sunday and special services from the start, and admins can change it', async () => {
    const [sunday, midweek] = await churchSvc.listServices();
    expect([sunday.livestream, midweek.livestream]).toEqual([true, false]);
    const special = await churchSvc.createService(
      { kind: 'special', name: 'Crusade', startTime: '17:00', date: '2026-10-17' },
      admin,
    );
    expect(special.livestream).toBe(true);
    const changed = await churchSvc.updateService('midweek', { livestream: true }, admin);
    expect(changed.livestream).toBe(true);
    await expect(
      churchSvc.updateService('sunday', { livestream: false }, { role: 'pastor' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
