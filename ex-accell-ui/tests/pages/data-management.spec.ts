import { test, expect } from '@playwright/test';

test.describe('Data Management', () => {
  test('data management page loads', async ({ page }) => {
    const response = await page.goto('/data-management');
    expect(response?.status()).toBe(200);
  });

  test('data capture page loads', async ({ page }) => {
    const response = await page.goto('/data-capture');
    expect(response?.status()).toBe(200);
  });

  test('workflow builder page loads', async ({ page }) => {
    const response = await page.goto('/data-management/workflow-builder');
    expect(response?.status()).toBe(200);
  });

  test('data processing page loads', async ({ page }) => {
    const response = await page.goto('/data-processing');
    expect(response?.status()).toBe(200);
  });

  test('pages have content', async ({ page }) => {
    const pages = ['/data-management', '/data-capture', '/data-processing'];
    for (const url of pages) {
      await page.goto(url);
      const text = await page.locator('body').textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});
