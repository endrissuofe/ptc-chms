import { test, expect } from '@playwright/test';

/**
 * End-to-end: needs the app running with seeded data (npm run seed && npm run dev).
 * Run: npm run test:e2e
 */
test('usher signs in and lands on Today', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('usher');
  await page.getByLabel('Password').fill('1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/today/);
});

test('usher cannot open the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('usher');
  await page.getByLabel('Password').fill('1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/today/);
});
