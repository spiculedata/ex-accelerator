import { beforeEach, describe, expect, it, vi } from 'vitest';

const revocation = vi.hoisted(() => ({ changeUserAccess: vi.fn(), changePassword: vi.fn() }));
vi.mock('$lib/server/auth/revocation', () => revocation);
vi.mock('$lib/server/auth/runtime', () => ({ prepareAuth: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { PATCH } from './+server';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

const patch = (id: string, body: unknown, actingId = ADMIN) =>
  PATCH({ params: { id }, request: new Request('http://localhost/api/users/x', { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) }), locals: { user: { id: actingId, role: 'admin' } } } as any);

beforeEach(() => {
  revocation.changeUserAccess.mockReset().mockResolvedValue('updated');
  revocation.changePassword.mockReset().mockResolvedValue(3);
});

describe('PATCH /api/users/[id] when the caller is not an admin', () => {
  it('refuses in the handler too, not only in the access guard', async () => {
    const response = await PATCH({ params: { id: OTHER }, request: new Request('http://localhost/api/users/x', { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) }), locals: { user: { id: ADMIN, role: 'user' } } } as any);
    expect(response.status).toBe(403);
    expect(revocation.changeUserAccess).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/users/[id]', () => {
  it('changes role, name and whether the person may sign in', async () => {
    const response = await patch(OTHER, { role: 'viewer', name: 'Renamed', disabled: true });
    expect(response.status).toBe(200);
    expect(revocation.changeUserAccess).toHaveBeenCalledWith(OTHER, { role: 'viewer', name: 'Renamed', disabled: true });
  });

  it('resets a password, which ends that person\'s sessions', async () => {
    const response = await patch(OTHER, { password: 'a-brand-new-password' });
    expect(response.status).toBe(200);
    expect(revocation.changePassword).toHaveBeenCalledWith(OTHER, 'a-brand-new-password');
    expect(revocation.changeUserAccess).not.toHaveBeenCalled();
  });

  it('refuses an id that is not a UUID before reaching the database', async () => {
    expect((await patch('1 OR 1=1', { role: 'user' })).status).toBe(400);
    expect(revocation.changeUserAccess).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown role', { role: 'root' }],
    ['a non-boolean disabled', { disabled: 'yes' }],
    ['an empty name', { name: '' }],
    ['a weak password', { password: 'short' }],
    ['nothing to change', {}],
    ['a list instead of an object', [1]]
  ])('refuses %s with a 400', async (_label, body) => {
    expect((await patch(OTHER, body)).status).toBe(400);
    expect(revocation.changeUserAccess).not.toHaveBeenCalled();
    expect(revocation.changePassword).not.toHaveBeenCalled();
  });

  it('refuses to let an admin change their own role, disable themselves, or reset their own password here', async () => {
    for (const body of [{ role: 'user' }, { disabled: true }, { password: 'a-brand-new-password' }]) {
      const response = await patch(ADMIN, body);
      expect(response.status).toBe(400);
    }
    expect(revocation.changeUserAccess).not.toHaveBeenCalled();
    expect(revocation.changePassword).not.toHaveBeenCalled();
  });

  it('still treats the admin\'s own id as their own when written in capitals', async () => {
    for (const body of [{ role: 'user' }, { disabled: true }, { password: 'a-brand-new-password' }]) {
      expect((await patch(ADMIN.toUpperCase(), body)).status).toBe(400);
    }
    expect(revocation.changeUserAccess).not.toHaveBeenCalled();
    expect(revocation.changePassword).not.toHaveBeenCalled();
  });

  it('lets an admin rename themselves', async () => {
    expect((await patch(ADMIN, { name: 'Me' })).status).toBe(200);
  });

  it('says 409 when that would remove the last active admin', async () => {
    revocation.changeUserAccess.mockResolvedValue('last-admin');
    const response = await patch(OTHER, { role: 'user' });
    expect(response.status).toBe(409);
  });

  it('says 404 for a person who does not exist', async () => {
    revocation.changeUserAccess.mockResolvedValue('not-found');
    expect((await patch(OTHER, { role: 'user' })).status).toBe(404);
  });

  it('says 404 when a password reset finds no such person', async () => {
    revocation.changePassword.mockRejectedValue(new Error('No such user'));
    expect((await patch(OTHER, { password: 'a-brand-new-password' })).status).toBe(404);
  });

  it('answers any other failure with a generic 500', async () => {
    revocation.changeUserAccess.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const response = await patch(OTHER, { role: 'user' });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5');
  });
});
