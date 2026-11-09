import { describe, it, expect } from 'vitest';
import { platformOptions } from './platformOptions';

describe('platformOptions', () => {
  it('lists each platform once, sorted, with a readable label', () => {
    expect(platformOptions(['youtube', 'telegram', 'youtube', 'bluesky'])).toEqual([
      { value: 'bluesky', label: 'Bluesky' },
      { value: 'telegram', label: 'Telegram' },
      { value: 'youtube', label: 'YouTube' }
    ]);
  });

  it('ignores case, blanks and missing values', () => {
    expect(platformOptions(['Telegram', 'telegram', '', null, undefined, '  '])).toEqual([{ value: 'telegram', label: 'Telegram' }]);
  });

  it('returns an empty list when there are no platforms', () => {
    expect(platformOptions([])).toEqual([]);
  });
});
