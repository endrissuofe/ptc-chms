import { describe, it, expect, beforeAll } from 'vitest';
import { eachLimited, isRetryable, sendWithRetry } from '@/lib/sms/reliable';

beforeAll(() => {
  process.env.SMS_RETRY_DELAY_MS = '0';
});

/** A provider that answers with each of `answers` in turn (then keeps the last). */
const flaky = (...answers) => {
  let i = 0;
  return {
    calls: 0,
    async send() {
      this.calls += 1;
      const a = answers[Math.min(i, answers.length - 1)];
      i += 1;
      if (a instanceof Error) throw a;
      return a;
    },
  };
};

describe('sending with retries', () => {
  it('tells passing trouble from a final answer', () => {
    expect(isRetryable({ error: 'Timed out after 15s' })).toBe(true);
    expect(isRetryable({ error: 'fetch failed' })).toBe(true);
    expect(isRetryable({ error: 'HTTP 503' })).toBe(true);
    expect(isRetryable({ error: '-6: Invalid recipient' })).toBe(false);
    expect(isRetryable({ error: '-7: Insufficient units' })).toBe(false);
    expect(isRetryable({ error: 'anything', retryable: true })).toBe(true);
  });

  it('tries again after a hiccup, up to 3 times in all', async () => {
    const p = flaky({ ok: false, error: 'fetch failed' }, new Error('socket hang up'), {
      ok: true,
    });
    expect(await sendWithRetry(p, {})).toMatchObject({ ok: true, attempts: 3 });

    const down = flaky({ ok: false, error: 'HTTP 502' });
    expect(await sendWithRetry(down, {})).toMatchObject({ ok: false, attempts: 3 });
    expect(down.calls).toBe(3);
  });

  it('does not retry a wrong number, or past the deadline', async () => {
    const bad = flaky({ ok: false, error: '-6: Invalid recipient', retryable: false });
    expect(await sendWithRetry(bad, {})).toMatchObject({ ok: false, attempts: 1 });

    const slow = flaky({ ok: false, error: 'fetch failed' }, { ok: true });
    expect(await sendWithRetry(slow, {}, { deadline: Date.now() + 1000 })).toMatchObject({
      ok: false,
      attempts: 1,
    });
  });

  it('works through a list a few at a time', async () => {
    let running = 0;
    let most = 0;
    const done = [];
    await eachLimited([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      running -= 1;
    });
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(most).toBe(3);
  });
});
