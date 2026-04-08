import { test, expect } from '@playwright/test';

test.describe('Datasets and Workspaces', () => {
  test('dashboards page loads at /dashboards', async ({ page }) => {
    const response = await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('workspaces endpoint works with /dashboards?workspace=1', async ({ page }) => {
    const response = await page.goto('/dashboards?workspace=1');
    await page.waitForLoadState('networkidle');

    // Page should load without a hard error (may show empty workspace data)
    expect(response?.status()).toBeLessThan(400);

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('workspace banner renders with workspace parameter', async ({ page }) => {
    await page.goto('/dashboards?workspace=1');
    await page.waitForLoadState('networkidle');

    // WorkspaceBanner component or workspace-related UI should render
    const hasBanner =
      (await page.locator('[data-testid="workspace-banner"]').count()) > 0 ||
      (await page.locator('[class*="workspace"], [class*="banner"]').count()) > 0 ||
      (await page.locator('text=/workspace/i').count()) > 0;

    expect(hasBanner).toBe(true);
  });

  test('FilterBar renders on dashboards page', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // FilterBar renders with platform selectors, date inputs, or filter controls
    const hasFilterUI =
      (await page.locator('[data-testid="filter-bar"]').count()) > 0 ||
      (await page.locator('input[type="date"]').count()) > 0 ||
      (await page.locator('select').count()) > 0 ||
      (await page.locator('[class*="filter"]').count()) > 0;

    expect(hasFilterUI).toBe(true);
  });

  test('workspace context propagates to text-analytics page', async ({ page }) => {
    await page.goto('/text-analytics?workspace=1');
    await page.waitForLoadState('networkidle');

    // The workspace parameter should be present in the URL
    expect(page.url()).toContain('workspace=1');

    // Page should still load correctly
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('workspace context propagates to topic-modeling page', async ({ page }) => {
    await page.goto('/text-analytics/topic-modeling?workspace=1');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('workspace=1');

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
