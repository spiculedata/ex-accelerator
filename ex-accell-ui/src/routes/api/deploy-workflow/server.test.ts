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

async function statusOf(promise: Promise<Response>): Promise<number> {
  try {
    return (await promise).status;
  } catch (thrown) {
    return (thrown as { status: number }).status;
  }
}

describe('POST /api/deploy-workflow', () => {
  beforeEach(() => {
    writeFile.mockClear();
    mkdir.mockClear();
  });

  it('deploys a workflow with a safe id', async () => {
    const response = await call({ workflowId: 'wf-1', workflowName: 'Demo', code: 'print(1)' });

    expect(response.status).toBe(200);
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
      const status = await statusOf(call({ workflowId, workflowName: 'x', code: 'print(1)' }));

      expect(status).toBe(400);
      expect(writeFile).not.toHaveBeenCalled();
    }
  );

  it('rejects missing fields', async () => {
    const status = await statusOf(call({ workflowId: 'wf-1' }));

    expect(status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
