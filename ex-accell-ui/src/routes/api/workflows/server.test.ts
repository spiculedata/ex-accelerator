import { describe, it, expect, vi, beforeEach } from 'vitest';

const publishWorkflow = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/serverWorkflowService', () => ({
  serverWorkflowService: { publishWorkflow, getPublishedWorkflows: vi.fn() }
}));

import { POST } from './+server';

const definition = { name: 'd', steps: [], connections: [] };

const call = (body: unknown, email: string | null = 'ada@example.com') =>
  POST({
    request: new Request('http://localhost/api/workflows', { method: 'POST', body: JSON.stringify(body) }),
    locals: { user: email ? { email } : null }
  } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  publishWorkflow.mockReset();
  publishWorkflow.mockResolvedValue({ id: 'wf_1' });
});

describe('POST /api/workflows', () => {
  it('publishes with the signed-in user as creator, without the form supplying one', async () => {
    const response = await call({ workflowDefinition: definition, metadata: { name: 'Flow', description: 'x' } });

    expect(response.status).toBe(200);
    expect(publishWorkflow).toHaveBeenCalledWith(definition, expect.objectContaining({ name: 'Flow', createdBy: 'ada@example.com' }));
  });

  it('ignores a createdBy supplied by the client', async () => {
    await call({ workflowDefinition: definition, metadata: { name: 'Flow', createdBy: 'forged@example.com' } });

    expect(publishWorkflow.mock.calls[0][1].createdBy).toBe('ada@example.com');
  });

  it('still requires a name', async () => {
    const response = await call({ workflowDefinition: definition, metadata: { description: 'x' } });

    expect(response.status).toBe(400);
    expect(publishWorkflow).not.toHaveBeenCalled();
  });
});
