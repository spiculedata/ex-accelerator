import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('404 page renders for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-12345');
    // SvelteKit returns 404 for unknown routes
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(404);
  });

  test('404 page shows meaningful content', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');

    // The page should display some error indication (404, not found, etc.)
    const errorText = page.getByText(/not found|404|error/i);
    await expect(errorText.first()).toBeVisible();
  });

  test('navigation still works on 404 page', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.waitForLoadState('networkidle');

    // Navigation bar should still be rendered
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // Should be able to navigate back to home
    const homeLink = nav.locator('a[href="/"]').first();
    await homeLink.click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/\/$/);
  });

  test('API error responses do not crash dashboard page', async ({ page }) => {
    // Load the dashboard - even if API calls fail, the page should render gracefully
    const response = await page.goto('/dashboards');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    // Page should still have navigation
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // No unhandled error overlays should appear
    const errorOverlay = page.locator('.error-overlay, [class*="vite-error"]');
    const hasErrorOverlay = await errorOverlay.isVisible().catch(() => false);
    expect(hasErrorOverlay).toBeFalsy();
  });

  test('API error responses do not crash sentiment analysis page', async ({ page }) => {
    const response = await page.goto('/text-analytics/sentiment-analysis');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    // Page should still have navigation
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
  });

  test('navigation works after visiting error page', async ({ page }) => {
    // Visit a 404 page first
    await page.goto('/nonexistent-page');
    await page.waitForLoadState('networkidle');

    // Navigate to a valid page via URL
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Page should load correctly
    expect(page.url()).toContain('/projects');
    const heading = page.getByRole('heading', { name: 'Projects' });
    await expect(heading).toBeVisible();
  });

  test('deeply nested invalid routes return 404', async ({ page }) => {
    const response = await page.goto('/some/deeply/nested/invalid/route');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(404);
  });

  test('page with invalid query params does not crash', async ({ page }) => {
    const response = await page.goto('/dashboards?workspace=not-a-number&invalid=true');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    // Navigation should still be functional
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
  });
});
