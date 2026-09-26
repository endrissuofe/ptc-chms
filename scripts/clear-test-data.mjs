/**
 * Clears trial data before going live: every first timer (with their visits, follow-up calls
 * and prayer requests) and every attendance count. Keeps logins, services, SMS templates,
 * SMS history, broadcasts and imported members.
 *
 *   npm run clear-test-data              -> shows what would be removed (changes nothing)
 *   npm run clear-test-data -- --confirm -> saves a backup to backups/, then removes it
 *
 * Reads MONGODB_URI from .env, or from the environment (PowerShell: $env:MONGODB_URI = "...").
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import mongoose from 'mongoose';

const confirm = process.argv.includes('--confirm');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '?');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const host = uri.replace(/^.*@/, '').replace(/[/?].*$/, '');
  console.log(`Database: ${db.databaseName} on ${host}\n`);

  const people = await db
    .collection('people')
    .find({}, { projection: { firstName: 1, lastName: 1, firstVisitDate: 1 } })
    .sort({ firstVisitDate: 1 })
    .toArray();
  const ids = people.map((p) => p._id);
  // Members created by moving a (trial) first timer across; imported members are kept.
  const movedMembers = { source: 'first_timer', person: { $in: ids } };

  const plan = [
    ['people', {}, 'first timers'],
    ['visits', {}, 'visits'],
    ['followups', {}, 'follow-up calls'],
    ['prayerrequests', {}, 'prayer requests'],
    ['attendances', {}, 'attendance counts'],
    ['members', movedMembers, 'members moved from those first timers'],
  ];
  const counts = await Promise.all(plan.map(([c, f]) => db.collection(c).countDocuments(f)));

  console.log('Will remove:');
  plan.forEach(([, , label], i) => console.log(`  ${String(counts[i]).padStart(5)}  ${label}`));
  console.log(
    '\nKept: logins, services, SMS templates, SMS history, broadcasts, imported members.',
  );
  if (people.length) {
    console.log('\nFirst timers on record (check these are all trial entries):');
    for (const p of people) console.log(`  ${day(p.firstVisitDate)}  ${p.firstName} ${p.lastName}`);
  }

  if (!confirm) {
    console.log('\nNothing changed. To remove these, run:  npm run clear-test-data -- --confirm');
    return;
  }
  if (counts.every((n) => n === 0)) {
    console.log('\nNothing to remove.');
    return;
  }
  if (!process.stdin.isTTY) {
    console.error('\nRun this in a terminal so you can confirm.');
    process.exitCode = 1;
    return;
  }
  if ((await ask('\nType DELETE to remove them: ')) !== 'DELETE') {
    console.log('Cancelled. Nothing changed.');
    return;
  }

  // Backup first, so a mistake can be undone.
  const backup = {};
  for (const [c, f] of plan) backup[c] = await db.collection(c).find(f).toArray();
  const dir = path.resolve('backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `trial-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 1));
  console.log(`Backup saved: ${file}`);

  for (const [c, f, label] of plan) {
    const { deletedCount } = await db.collection(c).deleteMany(f);
    console.log(`  removed ${deletedCount} ${label}`);
  }
  console.log('\nDone. The live site now starts from zero for first timers and counts.');
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
