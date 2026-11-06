import { describe, it, expect } from 'vitest';
import { isSafeIdentifier, assertSafeIdentifier, resolveWithin } from './pathSafety';

describe('isSafeIdentifier', () => {
  it.each(['wf-1', 'abc_def', 'Workflow123', 'wf_1700000000_exec-9'])(
    'accepts %s',
    (id) => {
      expect(isSafeIdentifier(id)).toBe(true);
    }
  );

  it.each([
    '',
    '..',
    '../etc/passwd',
    'a/b',
    'a\\b',
    'a b',
    'a;rm -rf /',
    '$(whoami)',
    'x`id`',
    'name\u0000.py',
    '.hidden',
    'a'.repeat(129)
  ])('rejects %j', (id) => {
    expect(isSafeIdentifier(id)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isSafeIdentifier(undefined)).toBe(false);
    expect(isSafeIdentifier(null)).toBe(false);
    expect(isSafeIdentifier(42)).toBe(false);
    expect(isSafeIdentifier({})).toBe(false);
  });
});

describe('assertSafeIdentifier', () => {
  it('returns the id when safe', () => {
    expect(assertSafeIdentifier('wf-1', 'workflowId')).toBe('wf-1');
  });

  it('throws naming the field when unsafe', () => {
    expect(() => assertSafeIdentifier('../x', 'workflowId')).toThrow(/workflowId/);
  });
});

describe('resolveWithin', () => {
  it('resolves a child path inside the base directory', () => {
    expect(resolveWithin('/srv/app/deployed', 'wf-1.py')).toBe('/srv/app/deployed/wf-1.py');
  });

  it('rejects traversal out of the base directory', () => {
    expect(() => resolveWithin('/srv/app/deployed', '../../etc/passwd')).toThrow(/outside/);
  });

  it('rejects absolute paths that escape the base directory', () => {
    expect(() => resolveWithin('/srv/app/deployed', '/etc/passwd')).toThrow(/outside/);
  });

  it('rejects a sibling directory sharing the base prefix', () => {
    expect(() => resolveWithin('/srv/app/deployed', '../deployed-evil/x.py')).toThrow(/outside/);
  });
});
