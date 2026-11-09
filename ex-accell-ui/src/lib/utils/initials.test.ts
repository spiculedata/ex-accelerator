import { describe, it, expect } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['ada', 'A'],
    ['  grace   brewster  hopper ', 'GH'],
    ['Demo admin', 'DA'],
    ['', '?'],
    ['   ', '?']
  ])('turns %j into %j', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('falls back to the email when there is no name', () => {
    expect(initials('', 'priya@example.com')).toBe('P');
  });
});
