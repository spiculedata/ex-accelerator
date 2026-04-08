import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('nonexistent page returns 404 or shows error', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-that-does-not-exist');
    const status = response?.status() ?? 0;
    // SvelteKit may return 404 or 200 with error content
    if (status === 200) {
      const body = await page.locator('body').textContent();
      expect(body?.toLowerCase()).toMatch(/not found|error|404/);
    } else {
      expect(status).toBeGreaterThanOrEqual(400);
    }
  });

  test('valid pages load without 500 errors', async ({ page }) => {
    const pages = ['/', '/dashboards', '/projects', '/text-analytics'];
    for (const url of pages) {
      const response = await page.goto(url);
      expect(response?.status()).toBeLessThan(500);
    }
  });
});
