/**
 * Applies database changes in order and records which ones have run.
 * Add a new entry to MIGRATIONS for each change; never edit one that has already run.
 * Run: npm run migrate
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const MIGRATIONS = [
  {
    id: '001-core-indexes',
    async up(db) {
      await db.collection('people').createIndex({ phone: 1 }, { unique: true });
      await db.collection('people').createIndex({ stage: 1, firstVisitDate: -1 });
      await db
        .collection('visits')
        .createIndex({ person: 1, serviceDate: 1, service: 1 }, { unique: true });
      await db
        .collection('attendances')
        .createIndex({ serviceDate: 1, service: 1 }, { unique: true });
      await db.collection('users').createIndex({ username: 1 }, { unique: true });
      await db
        .collection('smslogs')
        .createIndex(
          { runKey: 1, person: 1 },
          { unique: true, partialFilterExpression: { runKey: { $type: 'string' } } },
        );
    },
  },
  {
    id: '002-church-services',
    async up(db) {
      // Services are created by the app (default: Sunday Service 08:00); this only adds the index.
      await db.collection('churchservices').createIndex({ key: 1 }, { unique: true });
    },
  },
  {
    id: '003-service-schedules',
    async up(db) {
      // Services created before schedules existed were Sunday services.
      await db
        .collection('churchservices')
        .updateMany({ kind: { $exists: false } }, { $set: { kind: 'regular', days: [0] } });
      await db.collection('churchservices').updateMany({}, { $unset: { order: '' } });
      await db.collection('churchservices').createIndex({ kind: 1, date: 1 });
    },
  },
  {
    id: '004-shared-phone-numbers',
    async up(db) {
      // Family members may share a phone, so the phone index is no longer unique.
      const people = db.collection('people');
      if (await people.indexExists('phone_1')) await people.dropIndex('phone_1');
      await people.createIndex({ phone: 1 });
    },
  },
  {
    id: '005-instant-sms-members-broadcasts',
    async up(db) {
      // The thank-you now goes out when the card is saved, so "today" may be wrong.
      const OLD_THANKS =
        'Hi {FirstName}, thank you for worshipping with us at RCCG Peculiar Treasure Chapel today. You are welcome here, and we look forward to seeing you again. God bless you!';
      await db.collection('smstemplates').updateOne(
        { key: 'sunday_thanks', body: OLD_THANKS },
        {
          $set: {
            name: 'First-timer thank-you',
            body: 'Hi {FirstName}, thank you for worshipping with us at RCCG Peculiar Treasure Chapel. You are welcome here, and we look forward to seeing you again. God bless you!',
          },
        },
      );
      await db
        .collection('smstemplates')
        .updateOne({ key: 'sunday_thanks' }, { $set: { name: 'First-timer thank-you' } });

      // SMS logs now name who they were for as "p:<person>" or "m:<member>".
      const logs = db.collection('smslogs');
      for await (const log of logs.find({
        recipientKey: { $exists: false },
        person: { $ne: null },
      })) {
        await logs.updateOne({ _id: log._id }, { $set: { recipientKey: `p:${log.person}` } });
      }
      if (await logs.indexExists('runKey_1_person_1')) await logs.dropIndex('runKey_1_person_1');
      await logs.createIndex(
        { runKey: 1, recipientKey: 1 },
        { unique: true, partialFilterExpression: { runKey: { $type: 'string' } } },
      );
      await logs.createIndex({ run: 1, createdAt: -1 });

      await db.collection('members').createIndex({ phone: 1 });
      await db.collection('members').createIndex({ lastName: 1, firstName: 1 });
      await db.collection('broadcasts').createIndex({ createdAt: -1 });
    },
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const done = new Set((await db.collection('_migrations').find().toArray()).map((m) => m.id));

  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    console.log(`Running ${m.id}`);
    await m.up(db);
    await db.collection('_migrations').insertOne({ id: m.id, ranAt: new Date() });
  }
  console.log('Migrations up to date.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
