import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bulkSmsLiveProvider } from '@/lib/sms/bulksmslive';
import { getSmsProvider } from '@/lib/sms';

/** Fakes BulkSMSLive's replies; nothing is sent anywhere. */
function fakeFetch(status, body) {
  const fn = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('BulkSMSLive SMS provider', () => {
  beforeEach(() => {
    process.env.BULKSMSLIVE_API_KEY = 'test-key';
    delete process.env.BULKSMSLIVE_FORCEDND;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BULKSMSLIVE_API_KEY;
    delete process.env.SMS_PROVIDER;
  });

  it('is chosen with SMS_PROVIDER=bulksmslive', () => {
    process.env.SMS_PROVIDER = 'bulksmslive';
    expect(getSmsProvider().name).toBe('bulksmslive');
  });

  it('sends with the API key and reaches DND numbers by default', async () => {
    const fetch = fakeFetch(200, { status: 1, msg: 'Ok', msgid: 'a388383', units: 2 });
    const res = await bulkSmsLiveProvider.send({
      to: '+2348030000001',
      body: 'Hi Kemi',
      from: 'PTCChapel',
    });

    expect(res).toEqual({ ok: true, providerRef: 'a388383', cost: 2 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.bulksmslive.com/v2/app/sendsms');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(Object.fromEntries(init.body)).toEqual({
      message: 'Hi Kemi',
      sender_name: 'PTCChapel',
      recipients: '2348030000001',
      forcednd: '1',
    });
  });

  it('can skip DND numbers', async () => {
    process.env.BULKSMSLIVE_FORCEDND = '0';
    const fetch = fakeFetch(200, { status: '1', msgid: 1 });
    await bulkSmsLiveProvider.send({ to: '+2348030000001', body: 'x', from: 'PTCChapel' });
    expect(fetch.mock.calls[0][1].body.get('forcednd')).toBe('0');
  });

  it('explains an error code', async () => {
    fakeFetch(200, { status: -7 });
    const res = await bulkSmsLiveProvider.send({ to: '+2348030000001', body: 'x', from: 'P' });
    expect(res).toEqual({ ok: false, error: '-7: Insufficient units' });
  });

  it('prefers the reason BulkSMSLive gives', async () => {
    fakeFetch(200, { status: -4, msg: 'Sender name not approved' });
    const res = await bulkSmsLiveProvider.send({ to: '+2348030000001', body: 'x', from: 'P' });
    expect(res).toEqual({ ok: false, error: '-4: Sender name not approved' });
  });

  it('reports a wrong API key', async () => {
    fakeFetch(401, { message: 'Unauthenticated.' });
    const res = await bulkSmsLiveProvider.send({ to: '+2348030000001', body: 'x', from: 'P' });
    expect(res).toEqual({ ok: false, error: 'Unauthenticated: check the API key' });
  });

  it('refuses to send without an API key', async () => {
    delete process.env.BULKSMSLIVE_API_KEY;
    const res = await bulkSmsLiveProvider.send({ to: '+2348030000001', body: 'x', from: 'P' });
    expect(res).toEqual({ ok: false, error: 'BULKSMSLIVE_API_KEY is not set' });
  });

  it('reads the balance in units', async () => {
    const fetch = fakeFetch(200, { status: 1, amount: '458.00' });
    expect(await bulkSmsLiveProvider.balance()).toEqual({ balance: '458.00', currency: 'units' });
    expect(fetch.mock.calls[0][0]).toBe('https://api.bulksmslive.com/v2/app/balance');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });
});
