import mongoose from 'mongoose';
import { logger } from './logger';

/**
 * One shared MongoDB connection. In development Next.js reloads modules often,
 * so the connection is cached on globalThis to avoid opening a new one each time.
 */
const cached = globalThis.__mongoose || (globalThis.__mongoose = { conn: null, promise: null });

export async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env.');

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 5000 })
      .then((m) => {
        logger.info('Connected to MongoDB');
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export async function pingDB() {
  await connectDB();
  const res = await mongoose.connection.db.admin().ping();
  return res?.ok === 1;
}
