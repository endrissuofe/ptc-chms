import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000' },
  projects: [
    { name: 'usher-phone', use: { ...devices['Pixel 7'] } },
    { name: 'admin-desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
