import { describe, it, expect, vi, beforeEach } from 'vitest';

const createProject = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/projectsDb', () => ({ projectsDb: { createProject } }));

import { POST } from './+server';

const call = (body: unknown, user: { email: string } | null) =>
  POST({
    request: new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    locals: { user }
  } as unknown as Parameters<typeof POST>[0]);

describe('POST /api/projects', () => {
  beforeEach(() => {
    createProject.mockReset();
    createProject.mockResolvedValue({ id: 1 });
  });

  it('records the signed-in user as creator', async () => {
    await call({ name: 'p' }, { email: 'ada@example.com' });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: 'ada@example.com' })
    );
  });

  it('ignores a created_by supplied by the client', async () => {
    await call({ name: 'p', created_by: 'someone-else@example.com' }, { email: 'ada@example.com' });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: 'ada@example.com' })
    );
  });
});
