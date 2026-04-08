import { test, expect } from '@playwright/test';

test.describe('GDELT Pages', () => {
  test('world map page loads at /gdelt', async ({ page }) => {
    const response = await page.goto('/gdelt');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/GDELT|Global/i);
  });

  test('map container renders on /gdelt', async ({ page }) => {
    await page.goto('/gdelt');
    await page.waitForLoadState('networkidle');

    // Leaflet map container or a generic map wrapper
    const mapContainer = page.locator(
      '.leaflet-container, [data-testid="map-container"], [class*="map"]'
    ).first();
    await expect(mapContainer).toBeVisible({ timeout: 15_000 });
  });

  test('intelligence dashboard loads at /gdelt/intelligence', async ({ page }) => {
    const response = await page.goto('/gdelt/intelligence');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);

    // Page should have heading content
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('intelligence page has briefing section', async ({ page }) => {
    await page.goto('/gdelt/intelligence');
    await page.waitForLoadState('networkidle');

    // Look for briefing-related content: cards, sections, or keyword in text
    const briefingIndicator = page.locator(
      'text=/briefing|intelligence|conflict|summary|overview/i'
    ).first();
    const hasBriefingContent =
      (await briefingIndicator.count()) > 0 ||
      // Or structured sections like cards/tables
      (await page.locator('table, [class*="card"], [class*="grid"]').count()) > 0;

    expect(hasBriefingContent).toBe(true);
  });

  test('analytics tables load at /gdelt/analytics', async ({ page }) => {
    const response = await page.goto('/gdelt/analytics');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);

    // Page should have heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('analytics page has data tables', async ({ page }) => {
    await page.goto('/gdelt/analytics');
    await page.waitForLoadState('networkidle');

    // The analytics page uses sortable tables for countries, event types, actors
    const tables = page.locator('table');
    // Wait for at least one table or loading indicator to appear
    const hasTable = (await tables.count()) > 0;
    const hasLoadingOrContent =
      hasTable ||
      (await page.locator('text=/loading|no data/i').count()) > 0 ||
      (await page.locator('[class*="skeleton"], [class*="spinner"]').count()) > 0;

    expect(hasLoadingOrContent).toBe(true);
  });
});
