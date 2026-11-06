import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 12;
/** Longest password accepted anywhere (bounds the cost of hashing attacker-supplied input). */
export const MAX_PASSWORD_LENGTH = 1024;

/** Returns an error message, or null if the password is acceptable. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return 'Password is too long';
  }
  return null;
}

/** Hashes a password as `scrypt$N$r$p$salt$hash` (base64url salt and hash). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), derived.toString('base64url')].join('$');
}

/** Constant-time verification. Returns false for any malformed stored value. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltText, hashText] = parts;
  if (Number(n) !== SCRYPT.N || Number(r) !== SCRYPT.r || Number(p) !== SCRYPT.p) return false;
  if (!saltText || !hashText || password.length > MAX_PASSWORD_LENGTH) return false;

  const expected = Buffer.from(hashText, 'base64url');
  const derived = await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, SCRYPT);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
