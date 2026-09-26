import { logger } from '../logger';

/**
 * BulkSMS Nigeria provider (API v2).
 * Docs: https://www.bulksmsnigeria.com/api
 *   POST /api/v2/sms      { from, to, body, gateway }   -> { status: "success", data: { message_id, cost } }
 *   GET  /api/v2/balance                                -> { data: { total_balance, sms_wallet, ... } }
 * Auth: Authorization: Bearer <BULKSMSNIGERIA_API_TOKEN>
 */
const BASE = 'https://www.bulksmsnigeria.com/api/v2';

// direct-refund: refunds failed deliveries (good for DND numbers). Other options:
// direct-corporate, otp, dual-backup. Override with BULKSMSNIGERIA_GATEWAY in .env.
const gateway = () => process.env.BULKSMSNIGERIA_GATEWAY || 'direct-refund';

function headers() {
  const token = process.env.BULKSMSNIGERIA_API_TOKEN;
  if (!token) throw new Error('BULKSMSNIGERIA_API_TOKEN is not set');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export const bulkSmsNigeriaProvider = {
  name: 'bulksmsnigeria',

  async send({ to, body, from }) {
    try {
      const res = await fetch(`${BASE}/sms`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ from, to: to.replace('+', ''), body, gateway: gateway() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== 'success') {
        return {
          ok: false,
          error: `${data?.code || `HTTP ${res.status}`}: ${data?.error?.message || data?.message || 'Send failed'}`,
        };
      }
      return {
        ok: true,
        providerRef: data?.data?.message_id,
        cost: Number(data?.data?.cost) || undefined,
      };
    } catch (err) {
      logger.error({ err: err.message }, 'BulkSMS Nigeria request failed');
      return { ok: false, error: err.message };
    }
  },

  async balance() {
    const res = await fetch(`${BASE}/balance`, { headers: headers() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(
        `${data?.code || `HTTP ${res.status}`}: ${data?.error?.message || data?.message || ''}`,
      );
    return data?.data;
  },
};
