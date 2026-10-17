import { logger } from '../logger';
import { SEND_TIMEOUT_MS } from './reliable';

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

/** Busy or broken on their side (try again); a bad number or no units is final. */
const retryable = (data, status) =>
  status === 429 || status >= 500 || String(data?.status) === '-10';

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
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !succeeded(data)) {
        return {
          ok: false,
          error: errorText(data, res.status),
          retryable: retryable(data, res.status),
        };
      }
      return {
        ok: true,
        providerRef: data.msgid != null ? String(data.msgid) : undefined,
        cost: Number(data.units) || undefined,
      };
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      logger.error({ err: err.message }, 'BulkSMSLive request failed');
      return {
        ok: false,
        error: timedOut ? `Timed out after ${SEND_TIMEOUT_MS / 1000}s` : err.message,
        // No answer or no connection is worth another try; a setup problem (no key) is not.
        retryable: timedOut || err instanceof TypeError,
      };
    }
  },

  async balance() {
    const res = await fetch(`${BASE}/balance`, {
      method: 'POST',
      headers: headers(),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !succeeded(data)) throw new Error(errorText(data, res.status));
    return { balance: data.amount ?? data.balance ?? data.data?.balance, currency: 'units' };
  },
};
