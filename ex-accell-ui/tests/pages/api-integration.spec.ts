import { test, expect } from '@playwright/test';

test.describe('API Integration', () => {
  test('health endpoint returns JSON', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('projects endpoint returns JSON', async ({ request }) => {
    const response = await request.get('/api/projects');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('datasets endpoint returns JSON', async ({ request }) => {
    const response = await request.get('/api/datasets');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('unified analytics endpoint returns JSON', async ({ request }) => {
    const response = await request.get('/api/unified-analytics');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toBeDefined();
  });
});
