import { logger } from '../logger';

/**
 * Termii provider (https://developers.termii.com).
 *   POST {base}/api/sms/send   { api_key, to, from, sms, type: "plain", channel }
 *        -> { message_id, message: "Successfully Sent", balance, user }
 *   GET  {base}/api/get-balance?api_key=…  -> { user, balance, currency }
 *
 * Settings (hosting environment, never in code):
 *   TERMII_API_KEY    the account's API key
 *   TERMII_CHANNEL    "dnd" (default: reaches numbers on Do-Not-Disturb; needs a sender ID
 *                     approved for transactional use) or "generic" (promotional route)
 *   TERMII_BASE_URL   newer accounts show their own API address on the dashboard;
 *                     defaults to https://api.ng.termii.com
 */
const base = () => (process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/+$/, '');
const channel = () => process.env.TERMII_CHANNEL || 'dnd';

function apiKey() {
  const key = (process.env.TERMII_API_KEY || '').trim();
  if (!key) throw new Error('TERMII_API_KEY is not set');
  return key;
}

/** Termii's error text, whichever shape the response takes. */
function errorText(data, status) {
  const msg = data?.message || data?.error || data?.errors?.[0]?.message;
  return `${data?.code ? `${data.code}: ` : ''}${msg || `HTTP ${status}`}`;
}

export const termiiProvider = {
  name: 'termii',

  async send({ to, body, from }) {
    try {
      const res = await fetch(`${base()}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          api_key: apiKey(),
          to: to.replace('+', ''),
          from,
          sms: body,
          type: 'plain',
          channel: channel(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.message_id) {
        return { ok: false, error: errorText(data, res.status) };
      }
      return { ok: true, providerRef: String(data.message_id) };
    } catch (err) {
      logger.error({ err: err.message }, 'Termii request failed');
      return { ok: false, error: err.message };
    }
  },

  async balance() {
    const res = await fetch(`${base()}/api/get-balance?api_key=${encodeURIComponent(apiKey())}`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(errorText(data, res.status));
    return { balance: data.balance, currency: data.currency };
  },
};
