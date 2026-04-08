import { test, expect } from '@playwright/test';

test.describe('Data Management Pages', () => {
  test('data management page loads at /data-management', async ({ page }) => {
    const response = await page.goto('/data-management');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('data capture page loads at /data-capture', async ({ page }) => {
    const response = await page.goto('/data-capture');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('data sharing page loads at /data-sharing', async ({ page }) => {
    const response = await page.goto('/data-sharing');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('workflow builder loads at /data-management/workflow-builder', async ({ page }) => {
    const response = await page.goto('/data-management/workflow-builder');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);

    // Page should render without crashing
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('workflow canvas renders on /data-management/workflow-builder', async ({ page }) => {
    await page.goto('/data-management/workflow-builder');
    await page.waitForLoadState('networkidle');

    // The workflow builder uses a canvas area, step library, and config panel
    const hasCanvasUI =
      (await page.locator('[data-testid="workflow-canvas"], [class*="canvas"], [class*="workflow"]').count()) > 0 ||
      // Look for the step library or drag-and-drop area
      (await page.locator('text=/drag|step|workflow|pipeline|canvas/i').count()) > 0 ||
      // Or structural elements like sidebar + main area
      (await page.locator('[class*="sidebar"], [class*="panel"]').count()) > 0;

    expect(hasCanvasUI).toBe(true);
  });

  test('data management page has navigation to sub-sections', async ({ page }) => {
    await page.goto('/data-management');
    await page.waitForLoadState('networkidle');

    // Should have links or cards to data sources, datasets, workflows, etc.
    const hasNavElements =
      (await page.locator('a[href*="workflow"], a[href*="data-"]').count()) > 0 ||
      (await page.locator('text=/workflow|dataset|source|connector/i').count()) > 0;

    expect(hasNavElements).toBe(true);
  });
});
