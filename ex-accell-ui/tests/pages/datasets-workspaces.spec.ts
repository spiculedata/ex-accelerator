import { test, expect } from '@playwright/test';

test.describe('Datasets and Workspaces', () => {
  test('dashboards page loads with workspace param', async ({ page }) => {
    const response = await page.goto('/dashboards?workspace=1');
    expect(response?.status()).toBe(200);
  });

  test('dashboards page has content with workspace param', async ({ page }) => {
    await page.goto('/dashboards?workspace=1');
    const text = await page.locator('body').textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('data sharing page loads', async ({ page }) => {
    const response = await page.goto('/data-sharing');
    expect(response?.status()).toBe(200);
  });
});
