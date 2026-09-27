'use client';

/**
 * Talking to our own API from the browser. Errors come back as an Error with:
 *   status   HTTP status (0 when there is no connection)
 *   fields   { fieldName: message } for errors that belong to one form field
 *   signedOut true when the sign-in has expired or the login was switched off
 *   details   anything else the server sent (e.g. matches for a shared phone number)
 */
export class ApiError extends Error {
  constructor(message, { status = 0, fields = {}, signedOut = false, details } = {}) {
    super(message);
    this.details = details;
    this.status = status;
    this.fields = fields;
    this.signedOut = signedOut;
  }
}

export async function sendJson(url, method = 'POST', body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No connection. Check the Wi-Fi or data and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;

  const fields = {};
  for (const issue of Array.isArray(data.details) ? data.details : []) {
    const key = issue?.path?.[0];
    if (key && !fields[key]) fields[key] = issue.message;
  }
  const first = Object.values(fields)[0];
  throw new ApiError(
    res.status === 400 && first
      ? 'Please check the highlighted fields.'
      : data.error || 'Something went wrong. Please try again.',
    { status: res.status, fields, signedOut: res.status === 401, details: data.details },
  );
}
