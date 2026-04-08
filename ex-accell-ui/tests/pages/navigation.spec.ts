import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Dropdown menus open on click', () => {
    const dropdownNames = ['Social Analytics', 'GDELT', 'Images', 'Data'];

    for (const name of dropdownNames) {
      test(`${name} dropdown opens on click`, async ({ page }) => {
        const nav = page.locator('nav[aria-label="Main navigation"]');
        const dropdownButton = nav.locator('.nav-dropdown button', { hasText: name });
        await dropdownButton.click();

        // Dropdown panel should appear
        const dropdownPanel = nav.locator('.nav-dropdown .absolute');
        await expect(dropdownPanel).toBeVisible();
      });
    }
  });

  test('Social Analytics dropdown has expected items', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const button = nav.locator('.nav-dropdown button', { hasText: 'Social Analytics' });
    await button.click();

    const dropdown = nav.locator('.nav-dropdown .absolute').first();
    await expect(dropdown).toBeVisible();

    const expectedItems = [
      'Dashboard',
      'Sentiment Analysis',
      'Topic Modeling',
      'Language Detection',
      'Engagement',
      'Hashtags',
      'Trigrams',
      'Correlation'
    ];

    for (const item of expectedItems) {
      await expect(dropdown.getByText(item, { exact: true })).toBeVisible();
    }
  });

  test('GDELT dropdown has expected items', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const button = nav.locator('.nav-dropdown button', { hasText: 'GDELT' });
    await button.click();

    const dropdown = nav.locator('.nav-dropdown .absolute').first();
    await expect(dropdown).toBeVisible();

    const expectedItems = [
      'Intelligence Dashboard',
      'World Map',
      'Analytics Tables'
    ];

    for (const item of expectedItems) {
      await expect(dropdown.getByText(item, { exact: true })).toBeVisible();
    }
  });

  test('Images dropdown has expected items', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const button = nav.locator('.nav-dropdown button', { hasText: 'Images' });
    await button.click();

    const dropdown = nav.locator('.nav-dropdown .absolute').first();
    await expect(dropdown).toBeVisible();

    const expectedItems = [
      'Overview',
      'Object Detection',
      'Face Detection',
      'Content Moderation',
      'OCR & Text',
      'Classification',
      'Brand Recognition'
    ];

    for (const item of expectedItems) {
      await expect(dropdown.getByText(item, { exact: true })).toBeVisible();
    }
  });

  test('Data dropdown has expected items', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    // Use a more specific selector - the Data button is the last dropdown
    const buttons = nav.locator('.nav-dropdown button');
    // Find the one with exact text "Data" (with possible chevron SVG)
    const dataButton = nav.locator('.nav-dropdown button').filter({ hasText: /^Data/ });
    await dataButton.click();

    const dropdown = nav.locator('.nav-dropdown:last-of-type .absolute');
    await expect(dropdown).toBeVisible();

    const expectedItems = [
      'Data Management',
      'Data Capture',
      'Data Sharing',
      'Workflow Builder'
    ];

    for (const item of expectedItems) {
      await expect(dropdown.getByText(item, { exact: true })).toBeVisible();
    }
  });

  test('Research link navigates to research investigation page', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const researchLink = nav.locator('a', { hasText: 'Research' });
    await researchLink.click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/text-analytics/research-investigation');
  });

  test('clicking a dropdown item navigates to the correct URL', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');

    // Open GDELT dropdown and click World Map
    const gdeltButton = nav.locator('.nav-dropdown button', { hasText: 'GDELT' });
    await gdeltButton.click();

    const worldMapLink = nav.locator('.nav-dropdown .absolute a', { hasText: 'World Map' });
    await worldMapLink.click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/gdelt');
  });

  test('clicking Dashboard in Social Analytics navigates to /dashboards', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');

    const analyticsButton = nav.locator('.nav-dropdown button', { hasText: 'Social Analytics' });
    await analyticsButton.click();

    const dashboardLink = nav.locator('.nav-dropdown .absolute a', { hasText: 'Dashboard' }).first();
    await dashboardLink.click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/dashboards');
  });

  test('Home link navigates to root', async ({ page }) => {
    // First navigate away from home
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav[aria-label="Main navigation"]');
    const homeLink = nav.locator('a', { hasText: 'Home' });
    await homeLink.click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/\/$/);
  });

  test('active state highlighting works for current route', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The Home link should have the active/current styling (bg-blue-50 text-blue-700)
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const homeLink = nav.locator('a[aria-current="page"]');
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveText('Home');
  });

  test('closing dropdown when clicking outside', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');

    // Open a dropdown
    const gdeltButton = nav.locator('.nav-dropdown button', { hasText: 'GDELT' });
    await gdeltButton.click();

    const dropdown = nav.locator('.nav-dropdown .absolute');
    await expect(dropdown).toBeVisible();

    // Click outside the dropdown
    await page.locator('main').click();

    // Dropdown should close
    await expect(dropdown).not.toBeVisible();
  });
});
