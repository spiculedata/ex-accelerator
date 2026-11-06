import { defineConfig, devices } from '@playwright/test';

/**
 * Captures documentation screenshots from a running stack that holds the demo dataset.
 * See docs-screenshots/capture.spec.ts and `npm run docs:screenshots`.
 */
export default defineConfig({
  testDir: './docs-screenshots',
  outputDir: './test-results-screenshots',
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'reduce'
  }
});
