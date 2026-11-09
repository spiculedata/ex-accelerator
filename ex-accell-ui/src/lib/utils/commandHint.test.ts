import { describe, it, expect } from 'vitest';
import { extractCommand } from './commandHint';

describe('extractCommand', () => {
  it('finds the command in a backticked message', () => {
    expect(extractCommand('Jupyter is not set up yet: run `npm run jupyter:bootstrap` first')).toBe('npm run jupyter:bootstrap');
  });

  it('uses the first backticked command', () => {
    expect(extractCommand('Run `npm run a` then `npm run b`')).toBe('npm run a');
  });

  it.each([['Port 8888 is busy'], [''], ['a `` empty'], ['`not` a command']])('returns null when there is no command in %j', (message) => {
    expect(extractCommand(message)).toBeNull();
  });
});
