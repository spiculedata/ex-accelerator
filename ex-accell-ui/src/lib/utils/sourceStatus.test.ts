import { describe, it, expect } from 'vitest';
import { sourceStatusBadgeClass } from './sourceStatus';

describe('sourceStatusBadgeClass', () => {
  it('shows an error dataset in red', () => {
    expect(sourceStatusBadgeClass('error')).toContain('red');
  });

  it('shows a processing dataset as in progress, not as an unknown status', () => {
    const processing = sourceStatusBadgeClass('processing');

    expect(processing).not.toBe(sourceStatusBadgeClass('archived'));
    expect(processing).toContain('sky');
  });

  it('keeps active green and paused amber', () => {
    expect(sourceStatusBadgeClass('active')).toContain('emerald');
    expect(sourceStatusBadgeClass('paused')).toContain('amber');
  });

  it('ignores case and falls back to neutral for unknown or missing statuses', () => {
    expect(sourceStatusBadgeClass('ERROR')).toBe(sourceStatusBadgeClass('error'));
    expect(sourceStatusBadgeClass('archived')).toContain('slate');
    expect(sourceStatusBadgeClass(undefined)).toContain('slate');
  });
});
