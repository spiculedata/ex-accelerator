import { test, expect } from '@playwright/test';

test.describe('Image Processing', () => {
  test('main page loads', async ({ page }) => {
    const response = await page.goto('/image-processing');
    expect(response?.status()).toBe(200);
  });

  test('classification page loads', async ({ page }) => {
    const response = await page.goto('/image-processing/classification');
    expect(response?.status()).toBe(200);
  });

  test('object detection page loads', async ({ page }) => {
    const response = await page.goto('/image-processing/object-detection');
    expect(response?.status()).toBe(200);
  });

  test('face detection page loads', async ({ page }) => {
    const response = await page.goto('/image-processing/face-detection');
    expect(response?.status()).toBe(200);
  });

  test('OCR page loads', async ({ page }) => {
    const response = await page.goto('/image-processing/ocr');
    expect(response?.status()).toBe(200);
  });

  test('content moderation page loads', async ({ page }) => {
    const response = await page.goto('/image-processing/content-moderation');
    expect(response?.status()).toBe(200);
  });

  test('brand recognition page loads', async ({ page }) => {
    const response = await page.goto('/image-processing/brand-recognition');
    expect(response?.status()).toBe(200);
  });
});
