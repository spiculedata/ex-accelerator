import { test, expect } from '@playwright/test';

test.describe('Sentiment Analysis', () => {
  test('loads successfully', async ({ page }) => {
    const response = await page.goto('/text-analytics/sentiment-analysis');
    expect(response?.status()).toBe(200);
  });

  test('has a heading', async ({ page }) => {
    await page.goto('/text-analytics/sentiment-analysis');
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('page is not blank', async ({ page }) => {
    await page.goto('/text-analytics/sentiment-analysis');
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  // The analytics API is stubbed so these states do not depend on the database
  test('says so, in a status banner, when no posts match', async ({ page }) => {
    await page.route('**/api/unified-analytics**', (route) => route.fulfill({ json: { success: true, data: [] } }));
    await page.goto('/text-analytics/sentiment-analysis');
    await expect(page.getByRole('status').filter({ hasText: 'No posts match these filters' })).toBeVisible();
  });

  test('says so, in an alert, when the data cannot be loaded', async ({ page }) => {
    await page.route('**/api/unified-analytics**', (route) => route.fulfill({ status: 500, json: { success: false, error: 'Request failed' } }));
    await page.goto('/text-analytics/sentiment-analysis');
    await expect(page.getByRole('alert').filter({ hasText: 'We could not load sentiment data' })).toBeVisible();
  });
});
