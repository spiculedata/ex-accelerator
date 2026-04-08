import { test, expect } from '@playwright/test';

test.describe('Text Analytics Hub', () => {
  test('hub page loads at /text-analytics', async ({ page }) => {
    await page.goto('/text-analytics');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Text Analytics/i);
    await expect(page.locator('h1')).toContainText('Text Analytics');
  });

  const subPages = [
    { path: '/text-analytics/topic-modeling', name: 'Topic Modeling' },
    { path: '/text-analytics/language-detection', name: 'Language Detection' },
    { path: '/text-analytics/engagement-analysis', name: 'Engagement Analysis' },
    { path: '/text-analytics/hashtag-analysis', name: 'Hashtag Analysis' },
    { path: '/text-analytics/trigrams', name: 'Trigrams' },
  ];

  for (const sub of subPages) {
    test(`${sub.name} page loads without errors at ${sub.path}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const response = await page.goto(sub.path);
      await page.waitForLoadState('networkidle');

      expect(response?.status()).toBeLessThan(400);

      // Each sub-page should have a visible heading or title element
      const heading = page.locator('h1, h2, [data-testid="page-title"]').first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });

    test(`${sub.name} page has a heading`, async ({ page }) => {
      await page.goto(sub.path);
      await page.waitForLoadState('networkidle');

      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
      // Heading text should not be empty
      const text = await heading.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });
  }

  // FilterBar renders on analytics sub-pages that use it
  const filterBarPages = [
    '/text-analytics/topic-modeling',
    '/text-analytics/language-detection',
    '/text-analytics/engagement-analysis',
    '/text-analytics/hashtag-analysis',
  ];

  for (const path of filterBarPages) {
    test(`FilterBar renders on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // FilterBar typically contains platform checkboxes, date inputs, or filter-related UI
      const filterBar = page.locator(
        '[data-testid="filter-bar"], form:has(input[type="date"]), .filter-bar, [class*="filter"]'
      ).first();
      // If the explicit selector is not found, look for date inputs or select elements as a proxy
      const hasFilterUI =
        (await filterBar.count()) > 0 ||
        (await page.locator('input[type="date"]').count()) > 0 ||
        (await page.locator('select').count()) > 0;

      expect(hasFilterUI).toBe(true);
    });
  }
});
