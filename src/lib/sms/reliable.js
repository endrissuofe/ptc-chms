/**
 * Sending many SMS without losing any: each request has a time limit, passing hiccups are
 * retried, a few go out at once, and a run stops starting new messages before its function
 * would be cut off (those are logged as not sent, so "Resend failed" picks them up).
 */

/** Longest wait for the provider to answer one message. */
export const SEND_TIMEOUT_MS = 15000;

/** Messages in flight at once: quicker than one by one, gentle on the provider. */
export const SEND_CONCURRENCY = 4;

/** Error saved on messages a run had no time left to send. */
export const NOT_REACHED = 'Not sent: the run ran out of time. Use Resend failed.';

/** Pause before each retry (tests set SMS_RETRY_DELAY_MS=0). */
function retryDelays() {
  const base = Number(process.env.SMS_RETRY_DELAY_MS ?? 1000);
  return [base, base * 3];
}

/**
 * Worth trying again? Providers may say so (`retryable`); otherwise network trouble, time-outs,
 * "busy" and server errors are, while a bad number or an empty balance is not.
 */
export function isRetryable(res) {
  if (typeof res?.retryable === 'boolean') return res.retryable;
  return /time(d)? ?out|aborted|fetch failed|network|socket|ECONN|ETIMEDOUT|EAI_AGAIN|HTTP (429|5\d\d)|unknown error/i.test(
    res?.error ?? '',
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One message, tried up to 3 times when the failure looks passing. Never throws.
 * Gives up early rather than run past `deadline` (a timestamp in ms).
 */
export async function sendWithRetry(provider, message, { deadline = Infinity } = {}) {
  const delays = retryDelays();
  let res;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      res = await provider.send(message);
    } catch (err) {
      res = { ok: false, error: err?.message || 'Send failed', retryable: true };
    }
    if (res.ok || !isRetryable(res) || attempt > delays.length) break;
    const wait = delays[attempt - 1];
    if (Date.now() + wait + SEND_TIMEOUT_MS > deadline) break;
    await sleep(wait);
  }
  return { ...res, attempts: attempt };
}

/** Runs `fn` over `items`, at most `limit` at a time, in order of starting. */
export async function eachLimited(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
