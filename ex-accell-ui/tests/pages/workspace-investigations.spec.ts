import { test, expect, type APIRequestContext } from '@playwright/test';

// Creating an investigation from a workspace must file it under that workspace. The CI database has no
// demo data, so the test makes its own project and workspace through the API and removes them afterwards.

async function createJson(request: APIRequestContext, url: string, data: Record<string, unknown>) {
  const response = await request.post(url, { data });
  expect(response.ok(), `${url} -> ${response.status()}`).toBeTruthy();
  return response.json();
}

test.describe('Workspace investigations', () => {
  test('Create Investigation from a workspace posts its workspace_id', async ({ page, request }, testInfo) => {
    const stamp = `${Date.now()}-${testInfo.workerIndex}-${testInfo.project.name}`;
    const workspaceName = `E2E workspace ${stamp}`;
    let projectId: number | undefined;
    let investigationId: number | undefined;

    try {
      const { project } = await createJson(request, '/api/projects', { name: `E2E project ${stamp}` });
      projectId = project.id;
      const { workspace } = await createJson(request, '/api/workspaces', { project_id: project.id, name: workspaceName });

      await page.goto(`/investigations?workspace=${workspace.id}`);

      // The modal opens by itself and names the workspace it will create in
      await expect(page.getByText('Will be created in workspace:')).toBeVisible();
      await expect(page.getByText(workspaceName).first()).toBeVisible();

      await page.locator('#inv-name').fill(`E2E investigation ${stamp}`);
      const posted = page.waitForRequest((req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/investigations');
      const created = page.waitForResponse((res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/investigations');
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      expect((await posted).postDataJSON()).toMatchObject({ workspace_id: workspace.id });
      const body = await (await created).json();
      expect(body.success).toBe(true);
      investigationId = body.investigation?.id;
    } finally {
      if (investigationId !== undefined) await request.delete(`/api/investigations?id=${investigationId}`);
      if (projectId !== undefined) await request.delete(`/api/projects?id=${projectId}`);
    }
  });
});
