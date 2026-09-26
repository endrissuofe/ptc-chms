/**
 * Adds a sign-in, or resets the password and details of an existing one.
 * Run it yourself so real passwords are never written down anywhere:
 *
 *   npm run user:add -- --username ushers --name "Ushering Team" --role usher
 *
 * It asks for the password (typing is hidden). Reads MONGODB_URI from .env, or from the
 * environment, e.g. PowerShell:  $env:MONGODB_URI = "<Atlas connection string>"
 * Roles: usher, followup, pastor, admin.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import readline from 'node:readline';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ROLES = ['usher', 'followup', 'pastor', 'admin'];
const MIN_PASSWORD = 8;

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string' },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Reads a line without echoing what's typed. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) rl.output.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const username = values.username?.trim().toLowerCase();
const displayName = values.name?.trim();
const role = values.role?.trim();
if (!username || !displayName || !role) {
  fail('Usage: npm run user:add -- --username <name> --name "<Display Name>" --role <role>');
}
if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
  fail('Username: 3–30 characters, letters, numbers, dot, dash or underscore.');
}
if (!ROLES.includes(role)) fail(`Role must be one of: ${ROLES.join(', ')}`);
if (!process.stdin.isTTY) fail('Run this in a terminal so the password can be typed privately.');
if (!process.env.MONGODB_URI) fail('MONGODB_URI is not set.');

const password = await askHidden(`Password for ${username}: `);
if (password.length < MIN_PASSWORD) fail(`Use at least ${MIN_PASSWORD} characters.`);
if ((await askHidden('Type it again: ')) !== password) fail('The passwords did not match.');

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const users = mongoose.connection.db.collection('users');
const now = new Date();
const result = await users.updateOne(
  { username },
  {
    $set: {
      displayName,
      role,
      passwordHash: await bcrypt.hash(password, 10),
      active: true,
      updatedAt: now,
    },
    $setOnInsert: { username, createdAt: now },
  },
  { upsert: true },
);
await mongoose.disconnect();

console.log(
  result.upsertedCount
    ? `Added ${username} (${displayName}, ${role}).`
    : `Updated ${username}: new password, name and role saved.`,
);
