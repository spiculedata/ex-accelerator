import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';

describe('createLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prefixes the level and context and redacts sensitive keys, including nested ones', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createLogger('ctx').warn('careful', { user: 'a', password: 'p', nested: { Token: 't', ok: 1 } });

    const line = String(spy.mock.calls[0][0]);
    expect(line).toContain('WARN [ctx] careful');
    expect(line).toContain('"user":"a"');
    expect(line).toContain('"password":"[REDACTED]"');
    expect(line).toContain('"Token":"[REDACTED]"');
    expect(line).toContain('"ok":1');
    expect(line).not.toContain('"p"');
  });

  it('logs the message alone when there is no data', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    createLogger('ctx').error('boom');

    expect(String(spy.mock.calls[0][0])).toMatch(/ERROR \[ctx\] boom$/);
  });

  it('writes info to console.log and skips debug at the default level', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const logger = createLogger('ctx');
    logger.info('hello');
    logger.debug('quiet');

    expect(log).toHaveBeenCalledTimes(1);
    expect(debug).not.toHaveBeenCalled();
  });
});
