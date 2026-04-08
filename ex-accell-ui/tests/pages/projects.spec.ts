import { test, expect } from '@playwright/test';

test.describe('Projects', () => {
  test('projects page loads successfully', async ({ page }) => {
    const response = await page.goto('/projects');
    expect(response?.status()).toBe(200);
  });

  test('has a heading', async ({ page }) => {
    await page.goto('/projects');
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('new project page loads successfully', async ({ page }) => {
    const response = await page.goto('/projects/new');
    expect(response?.status()).toBe(200);
  });

  test('new project page has a heading', async ({ page }) => {
    await page.goto('/projects/new');
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });
});
