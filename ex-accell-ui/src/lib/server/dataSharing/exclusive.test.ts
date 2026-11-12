import { describe, it, expect } from 'vitest';
import { exclusive } from './exclusive';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('exclusive', () => {
  it('runs tasks one at a time, in the order asked', async () => {
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name} start`);
      await tick();
      log.push(`${name} end`);
      return name;
    };

    const results = await Promise.all([exclusive(task('a')), exclusive(task('b')), exclusive(task('c'))]);

    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['a start', 'a end', 'b start', 'b end', 'c start', 'c end']);
  });

  it('keeps running later tasks after one fails, and still reports the failure to its caller', async () => {
    const failing = exclusive(async () => {
      throw new Error('boom');
    });
    const after = exclusive(async () => 'ran');

    await expect(failing).rejects.toThrow('boom');
    await expect(after).resolves.toBe('ran');
  });
});
