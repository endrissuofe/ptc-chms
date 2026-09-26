import pino from 'pino';

/** Structured JSON logs in production; readable logs in development. */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { app: 'ptc-chms' },
  redact: ['phone', '*.phone', 'password', '*.password', 'prayerRequest', '*.prayerRequest'],
});
