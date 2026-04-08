import { test, expect } from '@playwright/test';

test.describe('GDELT', () => {
  test('main page loads successfully', async ({ page }) => {
    const response = await page.goto('/gdelt');
    expect(response?.status()).toBe(200);
  });

  test('intelligence page loads', async ({ page }) => {
    const response = await page.goto('/gdelt/intelligence');
    expect(response?.status()).toBe(200);
  });

  test('analytics page loads', async ({ page }) => {
    const response = await page.goto('/gdelt/analytics');
    expect(response?.status()).toBe(200);
  });

  test('pages have content', async ({ page }) => {
    await page.goto('/gdelt');
    const text = await page.locator('body').textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});
