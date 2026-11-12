import { describe, it, expect, vi, beforeEach } from 'vitest';

const generator = vi.hoisted(() => ({ generatePythonDaprWorkflow: vi.fn() }));
vi.mock('$lib/services/pythonDaprWorkflowGenerator', () => ({ pythonDaprWorkflowGenerator: generator }));

import { POST } from './+server';

const post = (body: unknown) =>
  POST({ request: new Request('http://localhost/x', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as never);

const generated = {
  pythonScript: 'print(1)',
  requirements: 'dapr',
  workflowCode: 'w',
  activityCode: 'a',
  appCode: 'app',
  workflowPattern: 'chaining',
  executionOrder: ['s1'],
  workflowName: 'Flow',
  internalOnly: 'must not be returned'
};

beforeEach(() => {
  generator.generatePythonDaprWorkflow.mockReset();
  generator.generatePythonDaprWorkflow.mockResolvedValue(generated);
});

describe('POST /api/generate-python-workflow', () => {
  it('returns only the documented fields in data and the legacy pythonWorkflow key', async () => {
    const response = await post({ workflowDefinition: { steps: [] } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(body.pythonWorkflow);
    expect(body.data.pythonScript).toBe('print(1)');
    expect(JSON.stringify(body)).not.toContain('internalOnly');
  });

  it.each([[{}], ['not json'], ['[1]']])('refuses %j with 400 and a failure envelope', async (body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null });
    expect(generator.generatePythonDaprWorkflow).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without the generator error text', async () => {
    generator.generatePythonDaprWorkflow.mockRejectedValue(new Error('TypeError at /srv/app/generator.ts:42'));

    const response = await post({ workflowDefinition: { steps: [] } });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to generate Python workflow' });
  });
});
