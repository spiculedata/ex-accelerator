import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('nav bar is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('has Home link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').getByText('Home')).toBeVisible();
  });

  test('has Social Analytics button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').getByText('Social Analytics')).toBeVisible();
  });

  test('has GDELT button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').getByText('GDELT')).toBeVisible();
  });

  test('has Research link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').getByText('Research')).toBeVisible();
  });

  test('clicking Home navigates to /', async ({ page }) => {
    await page.goto('/dashboards');
    await page.locator('nav').getByText('Home').click();
    await expect(page).toHaveURL('/');
  });

  test('logo link is visible', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('nav').getByRole('link', { name: 'Social Explorer home' });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('href', '/');
  });
});
