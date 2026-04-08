import { test, expect } from '@playwright/test';

test.describe('API Integration', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('unified analytics endpoint responds for cross-platform-sentiment', async ({ request }) => {
    const response = await request.get(
      '/api/unified-analytics?type=cross-platform-sentiment'
    );

    // Should respond (200 with data or structured error, not 500)
    expect(response.status()).toBeLessThan(500);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('datasets endpoint responds', async ({ request }) => {
    const response = await request.get('/api/datasets');

    expect(response.status()).toBeLessThan(500);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('projects endpoint responds', async ({ request }) => {
    const response = await request.get('/api/projects');

    expect(response.status()).toBeLessThan(500);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('workspaces endpoint responds', async ({ request }) => {
    const response = await request.get('/api/workspaces');

    expect(response.status()).toBeLessThan(500);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('unified analytics returns structured response', async ({ request }) => {
    const response = await request.get(
      '/api/unified-analytics?type=cross-platform-sentiment'
    );

    if (response.status() === 200) {
      const body = await response.json();
      // Response should have a success field or data structure
      expect(
        body.success !== undefined || body.data !== undefined || Array.isArray(body)
      ).toBe(true);
    }
  });

  test('datasets endpoint returns array or structured response', async ({ request }) => {
    const response = await request.get('/api/datasets');

    if (response.status() === 200) {
      const body = await response.json();
      expect(
        body.success !== undefined || body.datasets !== undefined || Array.isArray(body)
      ).toBe(true);
    }
  });

  test('projects endpoint returns array or structured response', async ({ request }) => {
    const response = await request.get('/api/projects');

    if (response.status() === 200) {
      const body = await response.json();
      expect(
        body.success !== undefined || body.projects !== undefined || Array.isArray(body)
      ).toBe(true);
    }
  });
});
