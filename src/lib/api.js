import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSession } from './auth';
import { hasRole } from './roles';
import { logger } from './logger';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Throws 401/403 unless the signed-in user has one of the roles. Returns the user. */
export async function requireRole(...roles) {
  const session = await getSession();
  if (!session?.user) throw new HttpError(401, 'Please sign in');
  if (roles.length && !hasRole(session.user, ...roles)) throw new HttpError(403, 'Not allowed');
  return session.user;
}

/** Wraps a route handler so errors become clean JSON responses. */
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: 'Check the form', details: err.issues }, { status: 400 });
      }
      if (err instanceof HttpError) {
        return NextResponse.json(
          { error: err.message, details: err.details },
          { status: err.status },
        );
      }
      if (err?.code === 11000) {
        return NextResponse.json({ error: 'This record already exists' }, { status: 409 });
      }
      logger.error({ err, url: req?.url }, 'Unhandled API error');
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
  };
}
