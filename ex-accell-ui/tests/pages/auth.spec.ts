import { test, expect } from '@playwright/test';

test.describe('authentication (signed out)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects anonymous page requests to the login page, keeping the destination', async ({ page }) => {
    await page.goto('/projects');

    await expect(page).toHaveURL(/\/login\?next=%2Fprojects/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('login page has labelled fields and hides the main navigation', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  });

  test('API requests without a session get 401 JSON', async ({ request }) => {
    const response = await request.get('/api/projects');

    expect(response.status()).toBe(401);
    expect((await response.json()).success).toBe(false);
  });

  test('code-execution endpoints reject anonymous callers', async ({ request }) => {
    const response = await request.post('/api/deploy-workflow', {
      data: { workflowId: 'x', workflowName: 'x', code: 'print(1)' }
    });

    expect(response.status()).toBe(401);
  });

  test('a forged session cookie is rejected', async ({ request }) => {
    const response = await request.get('/api/auth/me', { headers: { cookie: 'ex_session=forged.value' } });

    expect(response.status()).toBe(401);
  });
});

test.describe('authentication (signed in)', () => {
  test('the session cookie grants access and /login bounces to the app', async ({ page, request }) => {
    expect((await request.get('/api/auth/me')).status()).toBe(200);

    await page.goto('/login');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
