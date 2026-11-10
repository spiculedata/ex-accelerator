import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ getProjectById: vi.fn() }));
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
  db.getProjectById.mockReset();
});

describe('project page load', () => {
  it('answers 404 for an id that is not a whole number, without asking the database', async () => {
    for (const id of ['abc', '0', '-3', '1.5']) expect(await statusOf(id)).toBe(404);
    expect(db.getProjectById).not.toHaveBeenCalled();
  });

  it('answers 404 when no project has that id', async () => {
    db.getProjectById.mockResolvedValue(null);
    expect(await statusOf('999')).toBe(404);
  });

  it('loads when the project exists', async () => {
    db.getProjectById.mockResolvedValue({ id: 1 });
    expect(await statusOf('1')).toBeNull();
  });

  it('lets a database failure surface as an error, not a not-found', async () => {
    db.getProjectById.mockImplementation(async () => { throw new Error('db down'); });
    let caught: unknown = null;
    try {
      await load({ params: { id: '1' } } as any);
    } catch (thrown) {
      caught = thrown;
    }
    expect((caught as Error).message).toBe('db down');
    expect((caught as { status?: number }).status).toBeUndefined(); // not an HTTP error such as a 404
  });
});
