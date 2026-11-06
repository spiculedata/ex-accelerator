import { describe, it, expect } from 'vitest';
import { createLoginThrottle } from './throttle';

describe('createLoginThrottle', () => {
  const options = { maxAttempts: 3, windowMs: 1000 };

  it('allows attempts below the limit', () => {
    const throttle = createLoginThrottle(options);
    throttle.recordFailure('k', 0);
    throttle.recordFailure('k', 1);

    expect(throttle.isBlocked('k', 2)).toBe(false);
  });

  it('blocks once the limit is reached', () => {
    const throttle = createLoginThrottle(options);
    [0, 1, 2].forEach((t) => throttle.recordFailure('k', t));

    expect(throttle.isBlocked('k', 3)).toBe(true);
  });

  it('unblocks after the window passes', () => {
    const throttle = createLoginThrottle(options);
    [0, 1, 2].forEach((t) => throttle.recordFailure('k', t));

    expect(throttle.isBlocked('k', 1003)).toBe(false);
  });

  it('tracks keys independently', () => {
    const throttle = createLoginThrottle(options);
    [0, 1, 2].forEach((t) => throttle.recordFailure('a', t));

    expect(throttle.isBlocked('b', 3)).toBe(false);
  });

  it('reset clears a key after a successful login', () => {
    const throttle = createLoginThrottle(options);
    [0, 1].forEach((t) => throttle.recordFailure('k', t));
    throttle.reset('k');
    throttle.recordFailure('k', 2);

    expect(throttle.isBlocked('k', 3)).toBe(false);
  });

  it('bounds memory by evicting old keys', () => {
    const throttle = createLoginThrottle({ ...options, maxKeys: 2 });
    throttle.recordFailure('a', 0);
    throttle.recordFailure('b', 1);
    throttle.recordFailure('c', 2);

    expect(throttle.size()).toBeLessThanOrEqual(2);
  });
});
