import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken, type SessionUser } from './session';

const SECRET = 'a'.repeat(32);
const user: SessionUser = { id: '1', email: 'a@b.co', name: 'A', role: 'admin' };
const NOW = 1_700_000_000_000;

describe('session tokens', () => {
  it('round-trips a user', () => {
    const token = createSessionToken(user, SECRET, 3600, NOW);

    expect(verifySessionToken(token, SECRET, NOW + 1000)).toEqual(user);
  });

  it('rejects an expired token', () => {
    const token = createSessionToken(user, SECRET, 3600, NOW);

    expect(verifySessionToken(token, SECRET, NOW + 3601 * 1000)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken(user, SECRET, 3600, NOW);

    expect(verifySessionToken(token, 'b'.repeat(32), NOW)).toBeNull();
  });

  it('rejects a tampered payload (role escalation)', () => {
    const token = createSessionToken({ ...user, role: 'viewer' }, SECRET, 3600, NOW);
    const [, signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ u: { ...user, role: 'admin' }, exp: Math.floor(NOW / 1000) + 3600 })
    ).toString('base64url');

    expect(verifySessionToken(`${forgedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it.each([undefined, '', 'nodot', 'a.b.c', '.', 'abc.def'])('rejects malformed token %j', (token) => {
    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });

  it('rejects an unknown role even with a valid signature', () => {
    const token = createSessionToken({ ...user, role: 'root' as SessionUser['role'] }, SECRET, 3600, NOW);

    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });
});
