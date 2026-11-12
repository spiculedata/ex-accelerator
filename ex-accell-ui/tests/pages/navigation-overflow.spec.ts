import { test, expect } from '@playwright/test';

// The top navigation must never push the page wider than the window, or run its own content past the
// container. The context switchers only render once a project and workspace exist, so the test makes
// them (through the API) and removes them afterwards.

const WIDTHS = [768, 1024, 1180, 1280, 1300, 1330, 1366, 1440];

test.describe('Navigation overflow', () => {
  test('the navigation fits the window at common laptop widths', async ({ page, request }, testInfo) => {
    const stamp = `${Date.now()}-${testInfo.workerIndex}-${testInfo.project.name}`;
    const createdProject = await request.post('/api/projects', { data: { name: `E2E nav overflow project with a long name ${stamp}` } });
    expect(createdProject.ok(), `create project -> ${createdProject.status()}`).toBeTruthy();
    const { project } = await createdProject.json();

    try {
      const createdWorkspace = await request.post('/api/workspaces', {
        data: { project_id: project.id, name: `E2E nav overflow workspace with a long name ${stamp}` }
      });
      expect(createdWorkspace.ok(), `create workspace -> ${createdWorkspace.status()}`).toBeTruthy();
      const { workspace } = await createdWorkspace.json();

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/dashboards?workspace=${workspace.id}`);
        const nav = page.getByRole('navigation', { name: 'Main navigation' });
        await expect(nav).toBeVisible();

        const fit = await nav.evaluate((element) => {
          const limit = document.documentElement.clientWidth;
          const rights = Array.from(element.querySelectorAll('*'))
            .map((child) => child.getBoundingClientRect())
            .filter((box) => box.width > 0 && box.height > 0)
            .map((box) => box.right);
          return {
            pageOverflow: document.documentElement.scrollWidth - limit,
            navOverflow: element.scrollWidth - element.clientWidth,
            rightmost: Math.max(...rights) - limit
          };
        });

        expect(fit.pageOverflow, `page overflow at ${width}px`).toBeLessThanOrEqual(0);
        expect(fit.navOverflow, `nav overflow at ${width}px`).toBeLessThanOrEqual(0);
        expect(fit.rightmost, `nav content past the window at ${width}px`).toBeLessThanOrEqual(0);
      }
    } finally {
      await request.delete(`/api/projects?id=${project.id}`);
    }
  });
});
