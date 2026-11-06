import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password';

describe('hashPassword / verifyPassword', () => {
  it('verifies the correct password', async () => {
    const stored = await hashPassword('correct horse battery');

    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery');

    expect(await verifyPassword('wrong horse battery', stored)).toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const [first, second] = await Promise.all([hashPassword('same-password-1'), hashPassword('same-password-1')]);

    expect(first).not.toBe(second);
  });

  it('never stores the plaintext', async () => {
    expect(await hashPassword('plaintext-secret-1')).not.toContain('plaintext-secret-1');
  });

  it.each(['', 'not-a-hash', 'scrypt$bad', 'scrypt$16384$8$1$$'])('returns false for malformed stored value %j', async (stored) => {
    expect(await verifyPassword('anything', stored)).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('accepts passwords of at least 12 characters', () => {
    expect(validatePasswordStrength('twelve-chars')).toBeNull();
  });

  it('rejects short passwords with a message', () => {
    expect(validatePasswordStrength('short')).toMatch(/at least 12/);
  });

  it('rejects very long passwords (DoS guard)', () => {
    expect(validatePasswordStrength('a'.repeat(1025))).toMatch(/too long/);
  });
});
