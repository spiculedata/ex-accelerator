import { test, expect } from '@playwright/test';

test.describe('Text Analytics Hub', () => {
  test('hub page loads successfully', async ({ page }) => {
    const response = await page.goto('/text-analytics');
    expect(response?.status()).toBe(200);
  });

  test('topic modeling page loads', async ({ page }) => {
    const response = await page.goto('/text-analytics/topic-modeling');
    expect(response?.status()).toBe(200);
  });

  test('language detection page loads', async ({ page }) => {
    const response = await page.goto('/text-analytics/language-detection');
    expect(response?.status()).toBe(200);
  });

  test('engagement analysis page loads', async ({ page }) => {
    const response = await page.goto('/text-analytics/engagement-analysis');
    expect(response?.status()).toBe(200);
  });

  test('hashtag analysis page loads', async ({ page }) => {
    const response = await page.goto('/text-analytics/hashtag-analysis');
    expect(response?.status()).toBe(200);
  });

  test('all pages have content', async ({ page }) => {
    const pages = [
      '/text-analytics',
      '/text-analytics/topic-modeling',
      '/text-analytics/language-detection',
    ];
    for (const url of pages) {
      await page.goto(url);
      const text = await page.locator('body').textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});
