import { describe, it, expect } from 'vitest';
import { packageIdFor } from './packageId';
import { isSafeIdentifier } from './pathSafety';

describe('packageIdFor', () => {
  it('slugs a dataset name', () => {
    expect(packageIdFor('Telegram posts')).toBe('telegram-posts');
    expect(packageIdFor('GDELT  Events (2024)')).toBe('gdelt-events-2024');
  });

  it('never starts or ends with a dash, so the id is a safe path segment', () => {
    expect(packageIdFor('(2024) posts')).toBe('2024-posts');
    expect(packageIdFor('--x--')).toBe('x');
  });

  it('falls back to the dataset id when the name has nothing usable', () => {
    expect(packageIdFor('???', 7)).toBe('dataset-7');
    expect(packageIdFor('', '9')).toBe('dataset-9');
    expect(packageIdFor(null)).toBe('dataset');
  });

  it('keeps long names within the identifier limit', () => {
    const id = packageIdFor('a '.repeat(200));
    expect(id.length).toBeLessThanOrEqual(100);
    expect(isSafeIdentifier(id)).toBe(true);
  });
});
