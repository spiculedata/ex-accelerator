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
});
