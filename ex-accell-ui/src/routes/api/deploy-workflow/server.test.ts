import { describe, it, expect, vi, beforeEach } from 'vitest';

const { writeFile, mkdir } = vi.hoisted(() => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, default: { ...actual, writeFile, mkdir }, writeFile, mkdir };
});

import { POST } from './+server';

function call(body: unknown) {
  const request = new Request('http://localhost/api/deploy-workflow', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return POST({ request } as Parameters<typeof POST>[0]);
}

describe('POST /api/deploy-workflow', () => {
  beforeEach(() => {
    writeFile.mockClear();
    mkdir.mockClear();
  });

  it('deploys a workflow with a safe id', async () => {
    const response = await call({ workflowId: 'wf-1', workflowName: 'Demo', code: 'print(1)' });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { workflowId: 'wf-1' }, workflowId: 'wf-1' });
    expect(writeFile).toHaveBeenCalledTimes(2);
    const [pythonPath] = writeFile.mock.calls[0];
    expect(pythonPath).toMatch(/deployed-workflows\/wf-1\.py$/);
  });

  it('does not reveal the server file path in the response', async () => {
    const response = await call({ workflowId: 'wf-1', workflowName: 'Demo', code: 'print(1)' });
    const text = JSON.stringify(await response.json());

    expect(text).not.toContain('deployed-workflows');
    expect(text).not.toContain(process.cwd());
  });

  it.each(['../../etc/cron.d/evil', '..', 'a/b', '/abs/path', 'x;id'])(
    'rejects unsafe workflowId %j without writing files',
    async (workflowId) => {
      const response = await call({ workflowId, workflowName: 'x', code: 'print(1)' });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, data: null, error: expect.any(String) });
      expect(writeFile).not.toHaveBeenCalled();
    }
  );

  it('rejects missing fields', async () => {
    const response = await call({ workflowId: 'wf-1' });

    expect(response.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each([['not json'], ['[1]'], [JSON.stringify({ workflowId: 'wf-1', workflowName: 'x', code: 42 })]])(
    'rejects the body %s with 400 instead of failing',
    async (raw) => {
      const response = await POST({ request: new Request('http://localhost/x', { method: 'POST', body: raw }) } as Parameters<typeof POST>[0]);

      expect(response.status).toBe(400);
      expect(writeFile).not.toHaveBeenCalled();
    }
  );

  it('returns a generic 500 without the file system path', async () => {
    writeFile.mockRejectedValueOnce(new Error("EACCES: permission denied, open '/srv/app/deployed-workflows/wf-1.py'"));

    const response = await call({ workflowId: 'wf-1', workflowName: 'Demo', code: 'print(1)' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to deploy workflow' });
  });
});
