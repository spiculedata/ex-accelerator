import { describe, it, expect } from 'vitest';
import { createSingleFlight } from './singleFlight';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe('createSingleFlight', () => {
  it('runs the task when idle', async () => {
    let runs = 0;
    const run = createSingleFlight(async () => { runs++; });

    await run();

    expect(runs).toBe(1);
  });

  it('never runs two at once and runs again once afterwards, however many requests came in', async () => {
    const gates = [deferred(), deferred()];
    let started = 0;
    let active = 0;
    let maxActive = 0;
    const run = createSingleFlight(async () => {
      const gate = gates[started++];
      active++;
      maxActive = Math.max(maxActive, active);
      await gate.promise;
      active--;
    });

    const first = run();
    run();
    run();
    expect(started).toBe(1);

    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toBe(2);
    gates[1].resolve();
    await first;

    expect(started).toBe(2);
    expect(maxActive).toBe(1);
  });

  it('keeps going after a failed run', async () => {
    let runs = 0;
    const run = createSingleFlight(async () => {
      runs++;
      if (runs === 1) throw new Error('boom');
    });

    await expect(run()).rejects.toThrow('boom');
    await run();

    expect(runs).toBe(2);
  });
});
