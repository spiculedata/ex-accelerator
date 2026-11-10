import { describe, expect, it } from 'vitest';
import { canModifyInvestigation } from './investigationAccess';

describe('canModifyInvestigation', () => {
  const owner = { email: 'ada@example.com', role: 'analyst' };

  it('lets the person who created it change it', () => {
    expect(canModifyInvestigation(owner, 'ada@example.com')).toBe(true);
    expect(canModifyInvestigation({ email: 'ADA@example.com', role: 'analyst' }, 'ada@example.com')).toBe(true);
  });

  it('lets an admin change anyone\'s', () => {
    expect(canModifyInvestigation({ email: 'root@example.com', role: 'admin' }, 'ada@example.com')).toBe(true);
  });

  it('refuses someone else', () => {
    expect(canModifyInvestigation({ email: 'bob@example.com', role: 'analyst' }, 'ada@example.com')).toBe(false);
  });

  it('leaves older investigations with no recorded creator open to any signed-in user', () => {
    expect(canModifyInvestigation({ email: 'bob@example.com', role: 'analyst' }, null)).toBe(true);
  });

  it('refuses when nobody is signed in', () => {
    expect(canModifyInvestigation(null, 'ada@example.com')).toBe(false);
    expect(canModifyInvestigation(null, null)).toBe(false);
  });
});
