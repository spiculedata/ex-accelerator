import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walks through the tutorials against a stack that holds the demo dataset, capturing a screenshot
 * at each step. It creates real objects with stable names (removing leftovers from an earlier run
 * first) and deletes them afterwards.
 *
 * WARNING: it deletes any project, investigation or workflow with those names on the stack it logs
 * into, so run it only against a disposable demo stack.
 */
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs-site', 'public', 'screenshots', 'tutorials');
const SETTLE_MS = 1500;
const PROJECT_NAME = 'Tutorial project';
const INVESTIGATION_NAME = 'Tram delays';
const WORKFLOW_NAME = 'Sentiment of posts';

test.use({ viewport: { width: 1440, height: 1000 } });

const shot = async (page: Page, name: string, fullPage = false) => {
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: join(OUTPUT_DIR, `${name}.png`), fullPage, animations: 'disabled' });
};

test('tutorial walkthrough', async ({ page }) => {
  // Deletes objects by name on the stack it logs into, so it only runs when explicitly allowed
  test.skip(process.env.ALLOW_DOCS_CLEANUP !== '1', 'Set ALLOW_DOCS_CLEANUP=1 to run against a disposable demo stack');
  test.setTimeout(180_000);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const email = process.env.SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD;
  if (!email || !password) throw new Error('Set SCREENSHOT_EMAIL and SCREENSHOT_PASSWORD (the demo admin account)');
  const login = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(login.ok(), 'log in as the demo admin').toBe(true);

  // A failed delete would leave duplicates that change later screenshots, so make it loud
  // Soft assertions: in the final cleanup every delete is attempted even if an earlier one fails
  const expectDeleted = async (response: { ok(): boolean; status(): number }, what: string) => {
    expect.soft(response.ok(), `deleting ${what} (HTTP ${response.status()})`).toBe(true);
  };

  // Remove anything a previous (possibly interrupted) run left behind so names stay stable
  const removeByName = async (listUrl: string, key: string, deleteUrl: (id: string | number) => string, name: string) => {
    const list = await page.request.get(listUrl);
    expect(list.ok(), `listing ${key} (HTTP ${list.status()})`).toBe(true);
    const body = await list.json();
    for (const item of body[key] ?? []) {
      if (item.name === name) await expectDeleted(await page.request.delete(deleteUrl(item.id)), `${key} "${name}"`);
    }
  };
  await removeByName('/api/projects', 'projects', (id) => `/api/projects?id=${id}`, PROJECT_NAME);
  await removeByName('/api/investigations', 'investigations', (id) => `/api/investigations?id=${id}`, INVESTIGATION_NAME);
  await removeByName('/api/workflows', 'workflows', (id) => `/api/workflows/${id}`, WORKFLOW_NAME);

  const created: { project?: string; investigation?: string; workflow?: string } = {};
  try {
    // --- Tutorial: your first project ---
    await page.goto('/projects/new', { waitUntil: 'networkidle' });
    await shot(page, 'new-project', true);
    await page.fill('#project-name', PROJECT_NAME);
    await page.fill('#project-description', 'Following the first-project tutorial');
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/\d+/);
    created.project = page.url().match(/\/projects\/(\d+)/)![1];
    await page.waitForLoadState('networkidle');
    await shot(page, 'project-empty');

    await page.getByRole('button', { name: /New Workspace/ }).click();
    await page.getByPlaceholder(/Twitter Analysis/).fill('Telegram and YouTube');
    await page.locator('select').first().selectOption({ label: 'Analysis' });
    await page.getByPlaceholder('Describe the purpose...').fill('Telegram and YouTube posts only');
    await page.getByText('Demo Telegram local channels').click();
    await page.getByText('Demo YouTube city channels').click();
    await shot(page, 'workspace-form');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await expect(page.getByText('Telegram and YouTube').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await shot(page, 'workspace-created');

    // --- Tutorial: dashboards scoped to the workspace ---
    await page.getByRole('heading', { name: 'Telegram and YouTube' }).click();
    await page.waitForURL(/\/workspaces\/\d+/);
    const workspaceId = page.url().match(/\/workspaces\/(\d+)/)![1];
    await page.goto(`/text-analytics/sentiment-analysis?workspace=${workspaceId}`, { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 1440, height: 1350 });
    await shot(page, 'sentiment-scoped');
    await page.setViewportSize({ width: 1440, height: 1000 });

    // --- Tutorial: investigations ---
    await page.goto('/investigations', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /New Investigation/ }).first().click();
    await page.getByPlaceholder(/Ukraine Conflict/).fill(INVESTIGATION_NAME);
    await page.getByPlaceholder(/Describe the research question/).fill('Do tram delays dominate the transit conversation?');
    const keywords = page.getByPlaceholder(/Type keyword/);
    for (const keyword of ['tram', 'delays']) {
      await keywords.fill(keyword);
      await keywords.press('Enter');
    }
    await page.getByLabel('GDELT Events').uncheck();
    await page.getByLabel('Radio Transcripts').uncheck();
    await shot(page, 'investigation-form');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForURL(/\/investigations\/\d+/);
    created.investigation = page.url().match(/\/investigations\/(\d+)/)![1];
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(INVESTIGATION_NAME, { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: /social\s*[1-9]/i })).toBeVisible(); // matching posts were found
    await shot(page, 'investigation-workbench');

    // --- Tutorial: build and publish a workflow ---
    await page.goto('/data-management/workflow-builder', { waitUntil: 'networkidle' });
    await page.getByText('Dataset Input', { exact: true }).first().dragTo(page.locator('main'), { targetPosition: { x: 700, y: 300 } });
    await page.getByText('Sentiment Analysis', { exact: true }).first().dragTo(page.locator('main'), { targetPosition: { x: 1100, y: 300 } });
    const ports = page.locator('[class*="rounded-full"][class*="bg-blue"]');
    await expect(page.getByText('2 steps')).toBeVisible();
    await ports.nth(0).click();
    await ports.nth(1).click();
    await expect(page.getByText('1 connections')).toBeVisible();
    await shot(page, 'workflow-connected');

    // Publish stays disabled until every step has the settings it cannot run without
    await page.getByRole('button', { name: 'Workflow step: Dataset Input' }).click();
    await page.locator('select').filter({ hasText: 'Select dataset...' }).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Workflow step: Sentiment Analysis' }).click();
    await page.getByPlaceholder('text column name').fill('text');
    await expect(page.getByText('needs setup')).toHaveCount(0);
    await shot(page, 'workflow-configured');

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByLabel(/Workflow Name/).fill(WORKFLOW_NAME);
    await page.getByPlaceholder('Describe what this workflow does').fill('Loads posts and classifies their sentiment');
    await shot(page, 'workflow-publish');
    const published = page.waitForResponse((r) => r.url().endsWith('/api/workflows') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Publish Workflow' }).last().click();
    const body = await (await published).json();
    created.workflow = body.workflow?.id;
    expect(created.workflow, 'publishing returned a workflow id').toBeTruthy();
    // Publishing confirms with a browser dialog (Playwright dismisses it); the workflow is then listed on Data Management
    await page.goto('/data-management', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Processing Workflows/ }).click();
    await expect(page.getByText(WORKFLOW_NAME).first()).toBeVisible();
    await shot(page, 'workflow-published');
  } finally {
    // Remove everything this run created
    if (created.workflow) await expectDeleted(await page.request.delete(`/api/workflows/${created.workflow}`), 'the workflow');
    if (created.investigation) await expectDeleted(await page.request.delete(`/api/investigations?id=${created.investigation}`), 'the investigation');
    // Deleting the project also deletes its workspaces (ON DELETE CASCADE, migration 0002)
    if (created.project) await expectDeleted(await page.request.delete(`/api/projects?id=${created.project}`), 'the project');
  }
});
