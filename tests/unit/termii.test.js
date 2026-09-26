import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { termiiProvider } from '@/lib/sms/termii';
import { getSmsProvider } from '@/lib/sms';

/** Fakes Termii's replies; nothing is sent anywhere. */
function fakeFetch(status, body) {
  const fn = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('Termii SMS provider', () => {
  beforeEach(() => {
    process.env.TERMII_API_KEY = 'test-key';
    delete process.env.TERMII_CHANNEL;
    delete process.env.TERMII_BASE_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TERMII_API_KEY;
    delete process.env.SMS_PROVIDER;
  });

  it('is chosen with SMS_PROVIDER=termii', () => {
    process.env.SMS_PROVIDER = 'termii';
    expect(getSmsProvider().name).toBe('termii');
  });

  it('sends on the DND route by default, with the number in 234… form', async () => {
    const fetch = fakeFetch(200, { message_id: '3017544054459', message: 'Successfully Sent' });
    const res = await termiiProvider.send({
      to: '+2348030000001',
      body: 'Hi Kemi',
      from: 'PTCChapel',
    });

    expect(res).toEqual({ ok: true, providerRef: '3017544054459' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.ng.termii.com/api/sms/send');
    expect(JSON.parse(init.body)).toEqual({
      api_key: 'test-key',
      to: '2348030000001',
      from: 'PTCChapel',
      sms: 'Hi Kemi',
      type: 'plain',
      channel: 'dnd',
    });
  });

  it('uses the channel and address from the settings', async () => {
    process.env.TERMII_CHANNEL = 'generic';
    process.env.TERMII_BASE_URL = 'https://v3.api.termii.com/';
    const fetch = fakeFetch(200, { message_id: '1' });
    await termiiProvider.send({ to: '+2348030000001', body: 'x', from: 'PTCChapel' });
    expect(fetch.mock.calls[0][0]).toBe('https://v3.api.termii.com/api/sms/send');
    expect(JSON.parse(fetch.mock.calls[0][1].body).channel).toBe('generic');
  });

  it('reports Termii’s reason when it refuses', async () => {
    fakeFetch(400, { code: 'error', message: 'ApplicationSenderId not found' });
    const res = await termiiProvider.send({ to: '+2348030000001', body: 'x', from: 'PTCChapel' });
    expect(res).toEqual({ ok: false, error: 'error: ApplicationSenderId not found' });
  });

  it('treats a reply without a message id as a failure', async () => {
    fakeFetch(200, { message: 'Insufficient balance' });
    const res = await termiiProvider.send({ to: '+2348030000001', body: 'x', from: 'PTCChapel' });
    expect(res).toEqual({ ok: false, error: 'Insufficient balance' });
  });

  it('refuses to send without an API key', async () => {
    delete process.env.TERMII_API_KEY;
    const res = await termiiProvider.send({ to: '+2348030000001', body: 'x', from: 'PTCChapel' });
    expect(res).toEqual({ ok: false, error: 'TERMII_API_KEY is not set' });
  });

  it('reads the balance', async () => {
    const fetch = fakeFetch(200, { user: 'PTC', balance: 1500.5, currency: 'NGN' });
    expect(await termiiProvider.balance()).toEqual({ balance: 1500.5, currency: 'NGN' });
    expect(fetch.mock.calls[0][0]).toBe(
      'https://api.ng.termii.com/api/get-balance?api_key=test-key',
    );
  });
});
