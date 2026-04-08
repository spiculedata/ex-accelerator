import { test, expect } from '@playwright/test';

test.describe('Image Processing Pages', () => {
  test('hub page loads at /image-processing', async ({ page }) => {
    const response = await page.goto('/image-processing');
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  const subPages = [
    { path: '/image-processing/object-detection', name: 'Object Detection' },
    { path: '/image-processing/face-detection', name: 'Face Detection' },
    { path: '/image-processing/content-moderation', name: 'Content Moderation' },
    { path: '/image-processing/ocr', name: 'OCR' },
    { path: '/image-processing/classification', name: 'Image Classification' },
    { path: '/image-processing/brand-recognition', name: 'Brand Recognition' },
  ];

  for (const sub of subPages) {
    test(`${sub.name} sub-page loads at ${sub.path}`, async ({ page }) => {
      const response = await page.goto(sub.path);
      await page.waitForLoadState('networkidle');

      expect(response?.status()).toBeLessThan(400);

      // Each sub-page should render a heading
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });
  }

  // Pages that have image URL input or upload-related UI
  const pagesWithUploadArea = [
    '/image-processing/object-detection',
    '/image-processing/face-detection',
    '/image-processing/ocr',
    '/image-processing/classification',
  ];

  for (const path of pagesWithUploadArea) {
    test(`upload area or image input renders on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Look for image URL input, file upload, or drop zone
      const hasUploadUI =
        (await page.locator('input[type="file"]').count()) > 0 ||
        (await page.locator('input[type="url"], input[placeholder*="URL"], input[placeholder*="url"], input[placeholder*="http"]').count()) > 0 ||
        (await page.locator('[class*="drop"], [class*="upload"]').count()) > 0 ||
        (await page.locator('text=/upload|drop|image url|paste/i').count()) > 0;

      expect(hasUploadUI).toBe(true);
    });
  }

  // Pages with ModelTierSelector
  const pagesWithModelTier = [
    '/image-processing/object-detection',
    '/image-processing/face-detection',
    '/image-processing/ocr',
    '/image-processing/classification',
  ];

  for (const path of pagesWithModelTier) {
    test(`model tier selector renders on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // ModelTierSelector renders tier options (fast/balanced/accurate or similar)
      const hasTierSelector =
        (await page.locator('[data-testid="model-tier-selector"]').count()) > 0 ||
        (await page.locator('text=/fast|balanced|accurate|tier/i').count()) > 0 ||
        (await page.locator('button:has-text("Fast"), button:has-text("Balanced"), button:has-text("Accurate")').count()) > 0;

      expect(hasTierSelector).toBe(true);
    });
  }
});
