import { describe, expect, it } from 'vitest';
import { moduleBadge } from './imageModules';

describe('moduleBadge', () => {
  it('shows the count when the module has results', () => {
    expect(moduleBadge('totalObjects', { totalObjects: 1234 }, false)).toBe('1.2K');
  });

  it('says there are no results yet instead of claiming the module is ready', () => {
    expect(moduleBadge('totalObjects', { totalObjects: 0 }, false)).toBe('No results yet');
    expect(moduleBadge('totalObjects', {}, false)).toBe('No results yet');
  });

  it('says setup is needed when the image data is not available at all', () => {
    expect(moduleBadge('totalObjects', {}, true)).toBe('Needs setup');
  });

  it('marks a module with nothing to count as a preview, whatever the data', () => {
    expect(moduleBadge(null, {}, false)).toBe('Preview');
    expect(moduleBadge(null, {}, true)).toBe('Preview');
  });
});
