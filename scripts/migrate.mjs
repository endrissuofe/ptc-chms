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
