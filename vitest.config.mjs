import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/api/**/*.test.js'],
    // Tests never send real SMS or email, or call the AI.
    env: { SMS_PROVIDER: 'mock', EMAIL_PROVIDER: 'mock', AI_PROVIDER: 'mock' },
    testTimeout: 60000,
    hookTimeout: 120000,
  },
});
