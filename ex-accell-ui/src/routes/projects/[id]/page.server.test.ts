import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ getProjectById: vi.fn(), getWorkspaceById: vi.fn() }));
vi.mock('$lib/services/projectsDb', () => ({ projectsDb: db }));

import { load as loadProject } from './+page.server';
import { load as loadWorkspace } from '../../workspaces/[id]/+page.server';

const run = async (fn: (e: any) => Promise<unknown>, id: string) => {
  try {
    await fn({ params: { id } });
    return null;
  } catch (thrown: any) {
    return thrown.status as number;
  }
};

describe('project page load', () => {
  it('answers 404 for an id that is not a number or has no project', async () => {
    db.getProjectById.mockResolvedValue(null);
    expect(await run(loadProject, 'abc')).toBe(404);
    expect(await run(loadProject, '0')).toBe(404);
    expect(await run(loadProject, '999')).toBe(404);
  });

  it('loads when the project exists, and lets a database failure be a 500 rather than a not-found', async () => {
    db.getProjectById.mockResolvedValue({ id: 1 });
    expect(await run(loadProject, '1')).toBeNull();
    db.getProjectById.mockRejectedValue(new Error('db down'));
    await expect(loadProject({ params: { id: '1' } } as any)).rejects.toThrow('db down');
  });
});

describe('workspace page load', () => {
  it('answers 404 for an unknown workspace and loads a known one', async () => {
    db.getWorkspaceById.mockResolvedValue(null);
    expect(await run(loadWorkspace, '999')).toBe(404);
    expect(await run(loadWorkspace, 'x')).toBe(404);
    db.getWorkspaceById.mockResolvedValue({ id: 2 });
    expect(await run(loadWorkspace, '2')).toBeNull();
  });
});
