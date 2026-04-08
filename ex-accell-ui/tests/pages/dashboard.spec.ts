import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads successfully', async ({ page }) => {
    const response = await page.goto('/dashboards');
    expect(response?.status()).toBe(200);
  });

  test('has a heading', async ({ page }) => {
    await page.goto('/dashboards');
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('page is not blank', async ({ page }) => {
    await page.goto('/dashboards');
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});
