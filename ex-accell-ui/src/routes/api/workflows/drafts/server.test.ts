import { describe, it, expect, vi, beforeEach } from 'vitest';

const saveDraft = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/serverWorkflowService', () => ({ serverWorkflowService: { saveDraft } }));

import { POST } from './+server';

const definition = { name: 'd', steps: [{ id: 's1' }], connections: [] };

const call = (body: unknown, email: string | null = 'ada@example.com') =>
  POST({
    request: new Request('http://localhost/api/workflows/drafts', { method: 'POST', body: JSON.stringify(body) }),
    locals: { user: email ? { email } : null }
  } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  saveDraft.mockReset();
  saveDraft.mockResolvedValue({ id: 'wf_1', name: 'Flow', status: 'draft', updatedAt: '2026-11-09T10:00:00Z' });
});

describe('POST /api/workflows/drafts', () => {
  it('saves a draft for the signed-in user and returns its id', async () => {
    const response = await call({ workflowDefinition: definition, name: 'Flow', description: 'x' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, workflow: { id: 'wf_1', status: 'draft' } });
    expect(saveDraft).toHaveBeenCalledWith(definition, expect.objectContaining({ name: 'Flow', createdBy: 'ada@example.com' }), undefined);
  });

  it('passes an existing id so the draft is updated rather than duplicated', async () => {
    await call({ id: 'wf_5', workflowDefinition: definition, name: 'Flow' });

    expect(saveDraft.mock.calls[0][2]).toBe('wf_5');
  });

  it('falls back to a default name for an unnamed workflow', async () => {
    await call({ workflowDefinition: definition, name: '   ' });

    expect(saveDraft.mock.calls[0][1].name).toBe('Untitled workflow');
  });

  it.each([[undefined], [null], [{}], [{ steps: 'nope' }]])('rejects a definition without a steps list (%j)', async (workflowDefinition) => {
    const response = await call({ workflowDefinition, name: 'Flow' });

    expect(response.status).toBe(400);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without leaking internal error text', async () => {
    saveDraft.mockRejectedValue(new Error('password authentication failed for user postgres'));

    const response = await call({ workflowDefinition: definition, name: 'Flow' });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('password');
  });
});
