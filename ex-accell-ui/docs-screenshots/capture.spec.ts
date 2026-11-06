import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs-site', 'public', 'screenshots');

interface Shot {
  name: string;
  path: string;
  fullPage: boolean;
  /** Viewport height; taller than the default to include charts below the fold. */
  height?: number;
}

/** Pages that render fully from the demo dataset. */
const SHOTS: Shot[] = [
  { name: 'home', path: '/', fullPage: false },
  { name: 'projects', path: '/projects', fullPage: false },
  { name: 'sentiment-analysis', path: '/text-analytics/sentiment-analysis', fullPage: false, height: 1350 },
  { name: 'topic-modeling', path: '/text-analytics/topic-modeling', fullPage: true },
  { name: 'engagement-analysis', path: '/text-analytics/engagement-analysis', fullPage: false, height: 1350 },
  { name: 'language-detection', path: '/text-analytics/language-detection', fullPage: false, height: 1350 },
  { name: 'hashtag-analysis', path: '/text-analytics/hashtag-analysis', fullPage: false, height: 1100 }
];

const SETTLE_MS = 2000;

test.beforeAll(() => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
});

// Log in through the page's own request context so the session cookie is shared with the browser
test.beforeEach(async ({ page }) => {
  const email = process.env.SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD;
  if (!email || !password) throw new Error('Set SCREENSHOT_EMAIL and SCREENSHOT_PASSWORD (the demo admin account)');

  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(response.ok(), 'login with the demo admin account').toBe(true);
});

for (const shot of SHOTS) {
  test(`capture ${shot.name}`, async ({ page }) => {
    if (shot.height) await page.setViewportSize({ width: 1440, height: shot.height });
    await page.goto(shot.path, { waitUntil: 'networkidle' });
    await expect(page, 'should not be redirected to the login page').not.toHaveURL(/\/login/);
    await page.waitForTimeout(SETTLE_MS);

    await page.screenshot({
      path: join(OUTPUT_DIR, `${shot.name}.png`),
      fullPage: shot.fullPage,
      animations: 'disabled'
    });
  });
}
