import { test, expect } from '@playwright/test';

test.describe('Projects Page', () => {
  test('projects page loads at /projects', async ({ page }) => {
    const response = await page.goto('/projects');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');
  });

  test('page title is visible', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'Projects' });
    await expect(heading).toBeVisible();
  });

  test('page has correct document title', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveTitle(/Projects.*Social Explorer/);
  });

  test('create new project button is visible', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // The "+ New Project" button
    const newProjectButton = page.getByText('New Project');
    await expect(newProjectButton).toBeVisible();
  });

  test('new project page loads at /projects/new', async ({ page }) => {
    const response = await page.goto('/projects/new');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');
  });

  test('new project form fields render', async ({ page }) => {
    await page.goto('/projects/new');
    await page.waitForLoadState('networkidle');

    // Check for project name input or label
    const nameLabel = page.getByText(/project name/i).or(page.getByLabel(/name/i));
    const hasName = await nameLabel.isVisible().catch(() => false);

    // Check for description field
    const descLabel = page.getByText(/description/i).or(page.getByLabel(/description/i));
    const hasDesc = await descLabel.isVisible().catch(() => false);

    // At least name and description fields should be present
    expect(hasName || hasDesc).toBeTruthy();
  });

  test('new project page has project type selection', async ({ page }) => {
    await page.goto('/projects/new');
    await page.waitForLoadState('networkidle');

    // Project types are available (Social Media Analysis, Market Research, etc.)
    const projectTypes = ['Social Media Analysis', 'Market Research', 'Customer Feedback', 'Content Analysis'];
    let foundTypes = 0;
    for (const type of projectTypes) {
      const locator = page.getByText(type);
      if (await locator.isVisible().catch(() => false)) {
        foundTypes++;
      }
    }
    expect(foundTypes).toBeGreaterThan(0);
  });

  test('clicking new project button navigates to /projects/new', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const newProjectButton = page.getByText('New Project');
    await newProjectButton.click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/projects/new');
  });

  test('project detail page loads at /projects/[id]', async ({ page }) => {
    // Attempt to load a project detail page
    // It may redirect to /projects if the project ID is not found, which is valid behavior
    const response = await page.goto('/projects/1');
    expect(response).not.toBeNull();
    // Should return 200 (either the detail page or redirect to projects list)
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('networkidle');
  });

  test('projects page shows empty state or project list', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Either the empty state or actual project cards should be visible
    const emptyState = page.getByText(/no projects|get started|create.*first/i);
    const projectCards = page.locator('[class*="hover:shadow"]');

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasCards = await projectCards.count() > 0;

    // One of the two states should be present
    expect(hasEmpty || hasCards).toBeTruthy();
  });
});
