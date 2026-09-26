/**
 * Fills a development database with test users and sample newcomers.
 * Run: npm run seed   (reads MONGODB_URI from .env)
 * NEVER run against the live church database — it wipes the sample collections first.
 *
 * Test sign-ins (development only — change or remove before going live):
 *   admin    / admin123
 *   pastor   / pastor123
 *   usher    / 1234
 *   deborah  / 1234   (follow-up worker)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Copy .env.example to .env first.');
  process.exit(1);
}

// Seeding wipes the collections, so only ever touch a database on this machine or in the
// local Docker network — never Atlas or a server, even if MONGODB_URI points there.
const host = uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, '').split(/[/:?,]/)[0];
if (!['localhost', '127.0.0.1', 'mongo'].includes(host)) {
  console.error(`Refusing to seed ${host}: seeding wipes data and is only for a local database.`);
  process.exit(1);
}

const day = (iso) => new Date(`${iso}T00:00:00Z`);

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const c of [
    'users',
    'people',
    'visits',
    'attendances',
    'followups',
    'prayerrequests',
    'smslogs',
    'smstemplates',
    'churchservices',
  ]) {
    await db.collection(c).deleteMany({});
  }

  // Regular services: Sunday and midweek (Wednesday). Admins add more under Services.
  const SERVICE = 'sunday';
  const MIDWEEK = 'midweek';
  await db.collection('churchservices').insertMany(
    [
      { key: SERVICE, name: 'Sunday Service', kind: 'regular', days: [0], startTime: '08:00' },
      { key: MIDWEEK, name: 'Midweek Service', kind: 'regular', days: [3], startTime: '18:30' },
    ].map((svc) => ({ ...svc, active: true, createdAt: new Date(), updatedAt: new Date() })),
  );

  const hash = (p) => bcrypt.hashSync(p, 10);
  const users = await db.collection('users').insertMany([
    {
      username: 'admin',
      displayName: 'Church Admin',
      role: 'admin',
      passwordHash: hash('admin123'),
      active: true,
    },
    {
      username: 'pastor',
      displayName: 'Pastor-in-Charge',
      role: 'pastor',
      passwordHash: hash('pastor123'),
      active: true,
    },
    {
      username: 'usher',
      displayName: 'Bro. Emmanuel',
      role: 'usher',
      passwordHash: hash('1234'),
      active: true,
    },
    {
      username: 'deborah',
      displayName: 'Sis. Deborah Adeyemi',
      role: 'followup',
      passwordHash: hash('1234'),
      active: true,
    },
  ]);
  const deborah = users.insertedIds[3];

  const people = [
    {
      firstName: 'Kemi',
      lastName: 'Adebayo',
      phone: '+2348060000101',
      stage: 'first_timer',
      visits: ['2026-09-27'],
    },
    {
      firstName: 'Blessing',
      lastName: 'Emmanuel',
      phone: '+2349010000102',
      stage: 'first_timer',
      visits: ['2026-09-27'],
    },
    {
      firstName: 'Chinedu',
      lastName: 'Okafor',
      phone: '+2348034567890',
      stage: 'second_timer',
      visits: ['2026-09-06', '2026-09-27'],
      assigned: true,
      prayer: 'Safe delivery for my wife, and spiritual growth in the new week.',
    },
    {
      firstName: 'Grace',
      lastName: 'Amadi',
      phone: '+2348120000106',
      stage: 'first_timer',
      visits: ['2026-09-20'],
      assigned: true,
    },
    {
      firstName: 'Tunde',
      lastName: 'Bakare',
      phone: '+2347050000103',
      stage: 'first_timer',
      visits: ['2026-09-20'],
      assigned: true,
    },
    {
      firstName: 'Folake',
      lastName: 'Adeleke',
      phone: '+2348020000104',
      stage: 'regular',
      visits: ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'],
      assigned: true,
    },
  ];

  for (const p of people) {
    const dates = p.visits.map(day);
    const { insertedId } = await db.collection('people').insertOne({
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      smsConsent: true,
      cardUnclear: false,
      stage: p.stage,
      inBelieversClass: false,
      isMember: false,
      firstVisitDate: dates[0],
      lastVisitDate: dates[dates.length - 1],
      visitCount: dates.length,
      assignedTo: p.assigned ? deborah : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.collection('visits').insertMany(
      dates.map((d, i) => ({
        person: insertedId,
        serviceDate: d,
        service: SERVICE,
        source: i === 0 ? 'card' : 'returning',
        createdAt: new Date(),
      })),
    );
    if (p.prayer) {
      await db.collection('prayerrequests').insertOne({
        person: insertedId,
        text: p.prayer,
        status: 'new',
        serviceDate: dates[dates.length - 1],
        createdAt: new Date(),
      });
    }
  }

  const sundays = [
    '2026-08-09',
    '2026-08-16',
    '2026-08-23',
    '2026-08-30',
    '2026-09-06',
    '2026-09-13',
    '2026-09-20',
    '2026-09-27',
  ];
  const rows = sundays.map((s, i) => ({
    serviceDate: day(s),
    service: SERVICE,
    men: 74 + i,
    women: 102 + i,
    teens: 35,
    children: 47 + (i % 3),
    createdAt: new Date(),
  }));
  const wednesdays = ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23'];
  rows.push(
    ...wednesdays.map((w, i) => ({
      serviceDate: day(w),
      service: MIDWEEK,
      men: 31 + i,
      women: 48 + i,
      teens: 9,
      children: 6,
      createdAt: new Date(),
    })),
  );
  await db.collection('attendances').insertMany(rows);

  console.log(
    `Seeded ${users.insertedCount} users, ${people.length} people, ${rows.length} attendance rows.`,
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
