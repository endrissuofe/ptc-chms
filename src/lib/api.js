import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getCurrentUser } from './auth';
import { hasRole } from './roles';
import { logger } from './logger';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * Throws 401/403 unless the signed-in user has one of the roles. Returns the user.
 * Checks the database too, so a login that was switched off or changed stops working at once.
 */
export async function requireRole(...roles) {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Please sign in');
  if (user.status === 'inactive') throw new HttpError(401, 'This login has been switched off');
  if (user.status === 'changed') {
    throw new HttpError(401, 'Your access has changed. Please sign out and sign in again');
  }
  if (roles.length && !hasRole(user, ...roles)) throw new HttpError(403, 'Not allowed');
  return user;
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
