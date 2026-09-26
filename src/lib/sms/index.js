import { mockProvider } from './mock';
import { bulkSmsNigeriaProvider } from './bulksmsnigeria';

/**
 * Every SMS in the app goes through here. Change SMS_PROVIDER in .env to switch
 * providers; nothing else in the code needs to change.
 * A provider is { name, send({ to, body, from }) => { ok, providerRef, cost, error } }.
 */
const providers = {
  mock: mockProvider,
  bulksmsnigeria: bulkSmsNigeriaProvider,
};

export function getSmsProvider() {
  const name = process.env.SMS_PROVIDER || 'mock';
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown SMS_PROVIDER "${name}"`);
  return provider;
}

export { renderTemplate } from './templates';
