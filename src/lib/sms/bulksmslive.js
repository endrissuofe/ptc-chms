import { logger } from '../logger';

/**
 * BulkSMSLive provider (HTTP API 2.0, API-key method).
 *   POST /v2/app/sendsms   { message, sender_name, recipients, forcednd }
 *        -> { status: 1, msg, msgid, units, balance }   (status < 1 is an error code)
 *   POST /v2/app/balance   -> { status: 1, balance, ... }
 * Auth: Authorization: Bearer <BULKSMSLIVE_API_KEY>
 *
 * BULKSMSLIVE_FORCEDND: "1" (default) also reaches MTN numbers on Do-Not-Disturb, at 2 units
 * per page on MTN; "0" skips them.
 */
const BASE = 'https://api.bulksmslive.com/v2/app';
const forceDnd = () => (process.env.BULKSMSLIVE_FORCEDND === '0' ? '0' : '1');

const STATUS_TEXT = {
  '-2': 'Invalid parameter',
  '-3': 'Account suspended',
  '-4': 'Invalid sender name',
  '-5': 'Invalid message content',
  '-6': 'Invalid recipient',
  '-7': 'Insufficient units',
  '-10': 'Unknown error',
};

function headers() {
  const key = (process.env.BULKSMSLIVE_API_KEY || '').trim();
  if (!key) throw new Error('BULKSMSLIVE_API_KEY is not set');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
}

const succeeded = (data) => Number(data?.status) === 1;

function errorText(data, status) {
  if (status === 401) return 'Unauthenticated: check the API key';
  const code = data?.status != null ? String(data.status) : null;
  const msg = data?.msg || data?.message || STATUS_TEXT[code] || `HTTP ${status}`;
  return code && code !== '1' ? `${code}: ${msg}` : msg;
}

export const bulkSmsLiveProvider = {
  name: 'bulksmslive',

  async send({ to, body, from }) {
    try {
      const res = await fetch(`${BASE}/sendsms`, {
        method: 'POST',
        headers: headers(),
        body: new URLSearchParams({
          message: body,
          sender_name: from,
          recipients: to.replace('+', ''),
          forcednd: forceDnd(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !succeeded(data)) return { ok: false, error: errorText(data, res.status) };
      return {
        ok: true,
        providerRef: data.msgid != null ? String(data.msgid) : undefined,
        cost: Number(data.units) || undefined,
      };
    } catch (err) {
      logger.error({ err: err.message }, 'BulkSMSLive request failed');
      return { ok: false, error: err.message };
    }
  },

  async balance() {
    const res = await fetch(`${BASE}/balance`, { method: 'POST', headers: headers() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !succeeded(data)) throw new Error(errorText(data, res.status));
    return { balance: data.balance ?? data.data?.balance, currency: 'units' };
  },
};
