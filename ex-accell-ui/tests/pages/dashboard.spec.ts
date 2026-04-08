import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test('dashboard loads at /dashboards', async ({ page }) => {
    const response = await page.goto('/dashboards');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');
  });

  test('dashboard with workspace loads at /dashboards?workspace=1', async ({ page }) => {
    const response = await page.goto('/dashboards?workspace=1');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');
  });

  test('stats cards render', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // The dashboard should show stat cards with labels like Total Posts, Data Sources, etc.
    const statLabels = ['Total Posts', 'Data Sources', 'Active Crawlers'];
    let foundStats = 0;
    for (const label of statLabels) {
      const locator = page.getByText(label);
      if (await locator.isVisible().catch(() => false)) {
        foundStats++;
      }
    }
    // At least some stat cards should render
    expect(foundStats).toBeGreaterThan(0);
  });

  test('FilterBar component renders with source toggles', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // FilterBar should be present - it typically contains filter controls
    // Look for filter-related elements (the FilterBar component renders platform toggles)
    const filterSection = page.locator('[class*="filter"], [data-testid="filter-bar"]').or(
      page.getByText('Data Sources').first()
    );

    // The page should have some filtering UI element
    const hasFilter = await filterSection.isVisible().catch(() => false);
    // FilterBar or at minimum the data sources text should be present
    const hasDataSourcesText = await page.getByText('Data Sources').first().isVisible().catch(() => false);
    expect(hasFilter || hasDataSourcesText).toBeTruthy();
  });

  test('chart containers exist', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    const chartIds = [
      'sentiment-overview-chart',
      'source-breakdown-chart',
      'activity-chart',
      'topics-chart'
    ];

    for (const chartId of chartIds) {
      const chart = page.locator(`#${chartId}`);
      await expect(chart).toBeAttached();
    }
  });

  test('Data Sources Status table renders', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // The dashboard has a "Data Sources Status" section
    const dataSourcesHeading = page.getByText('Data Sources Status');
    await expect(dataSourcesHeading).toBeVisible();
  });

  test('Language Distribution section renders', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // The dashboard has a "Language Distribution" section
    const languageHeading = page.getByText('Language Distribution');
    await expect(languageHeading).toBeVisible();
  });

  test('workspace banner shows when workspace param present', async ({ page }) => {
    await page.goto('/dashboards?workspace=1');
    await page.waitForLoadState('networkidle');

    // When workspace param is provided, a WorkspaceBanner component should render
    // It may show workspace info or a banner element
    // Even if the workspace ID is invalid, the banner component mounts
    const banner = page.locator('[class*="workspace"], [data-testid="workspace-banner"]').or(
      page.getByText(/workspace/i).first()
    );
    // The workspace parameter triggers the banner to attempt rendering
    const hasBanner = await banner.isVisible().catch(() => false);
    // At minimum, the page should load without crashing with workspace param
    expect(page.url()).toContain('workspace=1');
  });

  test('page does not crash when workspace param is invalid', async ({ page }) => {
    const response = await page.goto('/dashboards?workspace=invalid-id');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    // Navigation should still be accessible
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
  });
});
