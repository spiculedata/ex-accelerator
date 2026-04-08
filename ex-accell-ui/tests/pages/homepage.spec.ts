import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('page loads successfully with 200 status', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
  });

  test('title contains Social Explorer', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Social Explorer/);
  });

  test('navigation bar renders with all top-level items', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // Check all top-level nav items are present
    await expect(nav.getByText('Home', { exact: true })).toBeVisible();
    await expect(nav.getByText('Social Analytics')).toBeVisible();
    await expect(nav.getByText('GDELT')).toBeVisible();
    await expect(nav.getByText('Images')).toBeVisible();
    await expect(nav.getByText('Research')).toBeVisible();
    await expect(nav.getByText('Data', { exact: true })).toBeVisible();
  });

  test('logo renders with SE branding', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The SE logo icon
    const logoIcon = page.locator('nav a[href="/"] span.text-white.font-bold');
    await expect(logoIcon).toHaveText('SE');

    // The Social Explorer text (visible on non-mobile)
    const logoText = page.locator('nav h1');
    await expect(logoText).toContainText('Social Explorer');
  });

  test('hero section is visible with welcome text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The hero section contains a welcome message
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Ready to explore your social data?')).toBeVisible();
  });

  test('app modules section renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The homepage shows application modules (fallback data at minimum)
    // Check that at least one known module name appears
    const moduleNames = ['Dashboards', 'Text Analytics', 'Data Capture', 'Image Processing'];
    let foundModules = 0;
    for (const name of moduleNames) {
      const locator = page.getByText(name, { exact: true });
      if (await locator.isVisible().catch(() => false)) {
        foundModules++;
      }
    }
    expect(foundModules).toBeGreaterThan(0);
  });

  test('responsive: mobile hamburger menu appears at small viewport', async ({ page }) => {
    // Set a mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The mobile menu toggle button should be visible
    const menuButton = page.locator('button[aria-label="Toggle menu"]');
    await expect(menuButton).toBeVisible();

    // Desktop nav links should be hidden at mobile size
    const desktopNav = page.locator('.hidden.lg\\:flex.lg\\:items-center');
    await expect(desktopNav).not.toBeVisible();
  });

  test('responsive: mobile menu opens when hamburger clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const menuButton = page.locator('button[aria-label="Toggle menu"]');
    await menuButton.click();

    // Mobile menu should appear with nav items
    const mobileMenu = page.locator('.lg\\:hidden.border-t');
    await expect(mobileMenu).toBeVisible();

    // Should contain navigation items
    await expect(mobileMenu.getByText('Home')).toBeVisible();
    await expect(mobileMenu.getByText('Social Analytics')).toBeVisible();
  });
});
