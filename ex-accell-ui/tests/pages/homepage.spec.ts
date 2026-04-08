import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('has page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Social Explorer/);
  });

  test('navigation bar is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('shows welcome heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });
});
