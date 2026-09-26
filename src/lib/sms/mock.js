import { logger } from '../logger';

/** Development provider: logs the message instead of sending it. Costs nothing. */
export const mockProvider = {
  name: 'mock',
  async send({ to, body, from }) {
    logger.info({ to: `${to.slice(0, 7)}****`, from, length: body.length }, `[mock SMS] ${body}`);
    return { ok: true, providerRef: `mock-${Date.now()}`, cost: 0 };
  },
};
