import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { createSessionToken, readSessionToken, verifySessionToken, type SessionUser } from './session';

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

describe('session version', () => {
  const secret = 's'.repeat(32);
  const user = { id: '1', email: 'a@b.co', name: 'A', role: 'user' as const };

  it('is carried in the token and read back', () => {
    const token = createSessionToken(user, secret, 3600, Date.now(), 7);
    expect(readSessionToken(token, secret)).toEqual({ user, sessionVersion: 7 });
  });

  it('is 0 for a token made without one, so sessions from before revocation existed stay valid', () => {
    const token = createSessionToken(user, secret, 3600);
    expect(readSessionToken(token, secret)?.sessionVersion).toBe(0);
    expect(verifySessionToken(token, secret)).toEqual(user);
  });

  it('cannot be changed without the secret', () => {
    const token = createSessionToken(user, secret, 3600, Date.now(), 1);
    const [encoded, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(encoded, 'base64url').toString()), sv: 99 })).toString('base64url');
    expect(readSessionToken(`${forged}.${signature}`, secret)).toBeNull();
  });

  it('is rejected when it is not a whole number', () => {
    const encoded = Buffer.from(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + 60, sv: 'x' })).toString('base64url');
    const signature = createHmac('sha256', secret).update(encoded).digest().toString('base64url');
    expect(readSessionToken(`${encoded}.${signature}`, secret)).toBeNull();
  });
});
