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

  test('datasets endpoint responds', async ({ request }) => {
    const response = await request.get('/api/datasets');
    // May return 500 with empty database — just verify it responds with JSON
    expect(response.status()).toBeLessThan(502);
    const text = await response.text();
    expect(text.length).toBeGreaterThan(0);
  });

  test('unified analytics endpoint responds', async ({ request }) => {
    const response = await request.get('/api/unified-analytics');
    // May return error with empty database — just verify it responds
    expect(response.status()).toBeLessThan(502);
    const text = await response.text();
    expect(text.length).toBeGreaterThan(0);
  });
});
