/**
 * Checks the BulkSMS Nigeria connection using the token in .env.
 *
 *   npm run sms:check                      -> shows your wallet balance only (costs nothing)
 *   npm run sms:check -- 08031234567       -> also sends ONE test SMS to that number
 *
 * Uses the same endpoint and settings as src/lib/sms/bulksmsnigeria.js.
 */
import 'dotenv/config';

const BASE = 'https://www.bulksmsnigeria.com/api/v2';
const token = process.env.BULKSMSNIGERIA_API_TOKEN;
const from = process.env.SMS_SENDER_ID || 'PTCChapel';
const gateway = process.env.BULKSMSNIGERIA_GATEWAY || 'direct-refund';

if (!token) {
  console.error('BULKSMSNIGERIA_API_TOKEN is empty in .env');
  process.exit(1);
}
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const balRes = await fetch(`${BASE}/balance`, { headers });
const bal = await balRes.json().catch(() => ({}));
if (!balRes.ok) {
  console.error(
    `Could not connect (${bal?.code || balRes.status}): ${bal?.error?.message || bal?.message || 'unknown error'}`,
  );
  process.exit(1);
}
console.log('Connected. Balance:', bal?.data);

const target = process.argv[2];
if (target) {
  let digits = target.replace(/\D/g, '');
  if (digits.startsWith('234')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[789][01]\d{8}$/.test(digits)) {
    console.error('That is not a valid Nigerian phone number.');
    process.exit(1);
  }
  const res = await fetch(`${BASE}/sms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from,
      to: `234${digits}`,
      body: 'Test from PTC Chapel church management system. If you got this, SMS is working.',
      gateway,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.status === 'success') {
    console.log(
      `Sent. Message id ${data.data?.message_id}, cost ${data.data?.cost} ${data.data?.currency ?? ''}`,
    );
  } else {
    console.error(
      `Failed (${data?.code || res.status}): ${data?.error?.message || data?.message || 'unknown error'}`,
    );
    process.exit(1);
  }
}
