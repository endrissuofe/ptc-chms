import { cache } from 'react';
import mongoose from 'mongoose';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { connectDB } from './db';
import User from '@/models/User';

export const authOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'PTC Chapel',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        await connectDB();
        const user = await User.findOne({
          username: credentials.username.toLowerCase(),
          active: true,
        });
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        await User.updateOne({ _id: user._id }, { lastSignInAt: new Date() });
        return { id: String(user._id), name: user.displayName, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.id = token.uid;
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

/**
 * The signed-in person as the database has them now. A sign-in lasts 12 hours, but an admin can
 * switch a login off or change its role in the meantime:
 *   status "ok"        use it
 *   status "inactive"  switched off (or deleted): treat as signed out
 *   status "changed"   role changed since sign-in: must sign in again
 * Cached for the length of one request.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id) return null;
  await connectDB();
  const user = mongoose.isValidObjectId(id)
    ? await User.findById(id).select('displayName role active').lean()
    : null;
  if (!user?.active) return { ...session.user, status: 'inactive' };
  if (user.role !== session.user.role) return { ...session.user, status: 'changed' };
  return { ...session.user, name: user.displayName, status: 'ok' };
});
