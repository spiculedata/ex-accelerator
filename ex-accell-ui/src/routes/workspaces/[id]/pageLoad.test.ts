import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ getWorkspaceById: vi.fn() }));
vi.mock('$lib/services/projectsDb', () => ({ projectsDb: db }));

import { load } from './+page.server';

const statusOf = async (id: string) => {
  try {
    await load({ params: { id } } as any);
    return null;
  } catch (thrown: any) {
    return thrown.status as number;
  }
};

beforeEach(() => {
  db.getWorkspaceById.mockReset();
});

describe('workspace page load', () => {
  it('answers 404 for an id that is not a whole number, without asking the database', async () => {
    for (const id of ['abc', '0', '-3']) expect(await statusOf(id)).toBe(404);
    expect(db.getWorkspaceById).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown workspace and loads a known one', async () => {
    db.getWorkspaceById.mockResolvedValue(null);
    expect(await statusOf('999')).toBe(404);
    db.getWorkspaceById.mockResolvedValue({ id: 2 });
    expect(await statusOf('2')).toBeNull();
  });

  it('lets a database failure surface as an error, not a not-found', async () => {
    db.getWorkspaceById.mockImplementation(async () => { throw new Error('db down'); });
    let caught: unknown = null;
    try {
      await load({ params: { id: '2' } } as any);
    } catch (thrown) {
      caught = thrown;
    }
    expect((caught as Error).message).toBe('db down');
    expect((caught as { status?: number }).status).toBeUndefined(); // not an HTTP error such as a 404
  });
});
