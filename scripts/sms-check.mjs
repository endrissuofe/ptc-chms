/**
 * Checks the SMS provider connection using the key in .env. Never prints the key.
 *
 *   npm run sms:check                      -> shows your balance only (costs nothing)
 *   npm run sms:check -- 08031234567       -> also sends ONE test SMS to that number
 *
 * Checks the provider named by SMS_PROVIDER (bulksmslive, termii or bulksmsnigeria); with
 * SMS_PROVIDER=mock it checks whichever of those has a key in .env, in that order.
 * Uses the same endpoints and settings as src/lib/sms/.
 */
import 'dotenv/config';

const from = process.env.SMS_SENDER_ID || 'PTCChapel';
const TEST_TEXT = 'Test from PTC Chapel church management system. If you got this, SMS is working.';

const PROVIDERS = {
  termii: {
    label: 'Termii',
    keyName: 'TERMII_API_KEY',
    async balance(key) {
      const base = (process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/+$/, '');
      const res = await fetch(`${base}/api/get-balance?api_key=${encodeURIComponent(key)}`);
      const data = await res.json().catch(() => ({}));
      return res.ok
        ? { ok: true, text: `${data.balance} ${data.currency ?? ''}` }
        : { ok: false, text: data?.message || `HTTP ${res.status}` };
    },
    async send(key, to) {
      const base = (process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/+$/, '');
      const channel = process.env.TERMII_CHANNEL || 'dnd';
      const res = await fetch(`${base}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ api_key: key, to, from, sms: TEST_TEXT, type: 'plain', channel }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data?.message_id
        ? { ok: true, text: `message id ${data.message_id} (channel ${channel})` }
        : { ok: false, text: data?.message || `HTTP ${res.status}` };
    },
  },
  bulksmslive: {
    label: 'BulkSMSLive',
    keyName: 'BULKSMSLIVE_API_KEY',
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    }),
    async balance(key) {
      const res = await fetch('https://api.bulksmslive.com/v2/app/balance', {
        method: 'POST',
        headers: this.headers(key),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && Number(data?.status) === 1
        ? { ok: true, text: `${data.balance ?? JSON.stringify(data)} units` }
        : { ok: false, text: `${data?.status ?? res.status}: ${data?.msg || data?.message || ''}` };
    },
    async send(key, to) {
      const res = await fetch('https://api.bulksmslive.com/v2/app/sendsms', {
        method: 'POST',
        headers: this.headers(key),
        body: new URLSearchParams({
          message: TEST_TEXT,
          sender_name: from,
          recipients: to,
          forcednd: process.env.BULKSMSLIVE_FORCEDND === '0' ? '0' : '1',
        }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && Number(data?.status) === 1
        ? { ok: true, text: `message id ${data.msgid}, ${data.units} units used` }
        : { ok: false, text: `${data?.status ?? res.status}: ${data?.msg || data?.message || ''}` };
    },
  },
  bulksmsnigeria: {
    label: 'BulkSMS Nigeria',
    keyName: 'BULKSMSNIGERIA_API_TOKEN',
    async balance(key) {
      const res = await fetch('https://www.bulksmsnigeria.com/api/v2/balance', {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      return res.ok
        ? { ok: true, text: JSON.stringify(data?.data) }
        : {
            ok: false,
            text: `${data?.code || res.status}: ${data?.error?.message || data?.message || ''}`,
          };
    },
    async send(key, to) {
      const res = await fetch('https://www.bulksmsnigeria.com/api/v2/sms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          body: TEST_TEXT,
          gateway: process.env.BULKSMSNIGERIA_GATEWAY || 'direct-refund',
        }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data?.status === 'success'
        ? { ok: true, text: `message id ${data.data?.message_id}` }
        : {
            ok: false,
            text: `${data?.code || res.status}: ${data?.error?.message || data?.message || ''}`,
          };
    },
  },
};

// Exit by setting exitCode, not process.exit(): on Windows, exiting while a request is
// still closing crashes Node with "Assertion failed … async.c".
async function main() {
  const chosen = process.env.SMS_PROVIDER;
  const name =
    chosen && chosen !== 'mock'
      ? chosen
      : process.env.BULKSMSLIVE_API_KEY
        ? 'bulksmslive'
        : process.env.TERMII_API_KEY
          ? 'termii'
          : 'bulksmsnigeria';
  const provider = PROVIDERS[name];
  if (!provider) {
    console.error(`Unknown SMS_PROVIDER "${name}"`);
    process.exitCode = 1;
    return;
  }
  const key = (process.env[provider.keyName] || '').trim();
  if (!key) {
    console.error(`${provider.keyName} is empty in .env`);
    process.exitCode = 1;
    return;
  }

  const bal = await provider.balance(key);
  if (!bal.ok) {
    console.error(`${provider.label}: could not connect — ${bal.text}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${provider.label}: connected. Balance: ${bal.text}`);

  const target = process.argv[2];
  if (!target) return;
  let digits = target.replace(/\D/g, '');
  if (digits.startsWith('234')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[789][01]\d{8}$/.test(digits)) {
    console.error('That is not a valid Nigerian phone number.');
    process.exitCode = 1;
    return;
  }
  const sent = await provider.send(key, `234${digits}`);
  if (sent.ok) console.log(`Sent from "${from}": ${sent.text}`);
  else {
    console.error(`Failed: ${sent.text}`);
    process.exitCode = 1;
  }
}

await main();
