import nodemailer from 'nodemailer';
import { logger } from '../logger';

/**
 * Every email the app sends goes through here. EMAIL_PROVIDER picks how:
 *   mock   write it to the log only (development and tests; the default)
 *   gmail  send through the church Gmail: GMAIL_USER + GMAIL_APP_PASSWORD (a Google
 *          "app password", not the normal password). Up to ~500 emails a day.
 * Settings live in the hosting environment, never in code.
 */
export function emailStatus() {
  const provider = process.env.EMAIL_PROVIDER || 'mock';
  return { provider, live: provider !== 'mock', from: process.env.GMAIL_USER || null };
}

let transport;
function gmail() {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set');
  transport ??= nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return { transport, user };
}

/** Sends one email. Returns { ok, id } or { ok: false, error }; never throws. */
export async function sendEmail({ to, cc = [], subject, html, text }) {
  const { provider } = emailStatus();
  const recipients = [to].flat().filter(Boolean);
  if (!recipients.length) return { ok: false, error: 'No recipients' };

  if (provider === 'mock') {
    logger.info({ to: recipients, cc, subject }, 'Email (mock, not sent)');
    return { ok: true, id: `mock-${Date.now()}` };
  }
  if (provider !== 'gmail') return { ok: false, error: `Unknown EMAIL_PROVIDER "${provider}"` };

  try {
    const { transport: t, user } = gmail();
    const name = process.env.EMAIL_FROM_NAME || 'PTC Chapel';
    const info = await t.sendMail({
      from: `"${name}" <${user}>`,
      to: recipients,
      cc: [cc].flat().filter(Boolean),
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    logger.error({ err: err.message }, 'Email failed');
    return { ok: false, error: err.message };
  }
}
