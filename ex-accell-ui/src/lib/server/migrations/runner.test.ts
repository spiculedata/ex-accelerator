import { describe, it, expect } from 'vitest';
import { LEGACY_BASELINE, planMigrations, runMigrations, type Migration, type MigrationClient } from './runner';

const m = (name: string): Migration => ({ name, sql: `-- ${name}` });
const core = LEGACY_BASELINE.map(m);

describe('planMigrations', () => {
  it('runs everything on a fresh database', () => {
    const plan = planMigrations(core, [], false);

    expect(plan.toRun.map((x) => x.name)).toEqual(LEGACY_BASELINE);
    expect(plan.toBaseline).toEqual([]);
  });

  it('baselines the legacy migrations on an install that predates the runner', () => {
    const plan = planMigrations([...core, m('0004_new')], [], true);

    expect(plan.toBaseline).toEqual(LEGACY_BASELINE);
    expect(plan.toRun.map((x) => x.name)).toEqual(['0004_new']);
  });

  it('skips migrations that were already applied', () => {
    const plan = planMigrations([...core, m('0004_new')], LEGACY_BASELINE, false);

    expect(plan.toRun.map((x) => x.name)).toEqual(['0004_new']);
  });

  it('does not treat a database with recorded migrations as legacy', () => {
    const plan = planMigrations([...core, m('0004_new')], ['0001_core'], true);

    expect(plan.toBaseline).toEqual([]);
    expect(plan.toRun.map((x) => x.name)).toEqual(LEGACY_BASELINE.slice(1).concat('0004_new'));
  });

  it('orders migrations by name', () => {
    const plan = planMigrations([m('0002_b'), m('0001_a')], [], false);

    expect(plan.toRun.map((x) => x.name)).toEqual(['0001_a', '0002_b']);
  });
});

function fakeClient(options: { applied?: string[]; hasPosts?: boolean; failOn?: string } = {}) {
  const log: string[] = [];
  const client: MigrationClient = {
    async query(text: string) {
      log.push(text.trim().split('\n')[0]);
      if (/FROM schema_migrations/i.test(text)) {
        return { rows: (options.applied ?? []).map((name) => ({ name })) };
      }
      if (/to_regclass/i.test(text)) {
        return { rows: [{ present: options.hasPosts ?? false }] };
      }
      if (options.failOn && text.includes(options.failOn)) throw new Error('boom');
      return { rows: [] };
    }
  };
  return { client, log };
}

describe('runMigrations', () => {
  it('applies each migration inside its own transaction, then unlocks', async () => {
    const { client, log } = fakeClient();

    const result = await runMigrations(client, [m('0001_core')]);

    expect(result).toEqual({ applied: ['0001_core'], baselined: [] });
    const begin = log.indexOf('BEGIN');
    expect(begin).toBeGreaterThan(-1);
    expect(log.slice(begin, begin + 2)).toEqual(['BEGIN', '-- 0001_core']);
    expect(log).toContain('COMMIT');
    expect(log[log.length - 1]).toMatch(/pg_advisory_unlock/);
  });

  it('records legacy installs as baselined without executing their SQL', async () => {
    const { client, log } = fakeClient({ hasPosts: true });

    const result = await runMigrations(client, core);

    expect(result.baselined).toEqual(LEGACY_BASELINE);
    expect(result.applied).toEqual([]);
    expect(log.some((line) => line.startsWith('-- 000'))).toBe(false);
    expect(log).not.toContain('BEGIN');
  });

  it('rolls back, names the failing migration and still unlocks', async () => {
    const { client, log } = fakeClient({ failOn: '-- 0001_core' });

    await expect(runMigrations(client, [m('0001_core')])).rejects.toThrow(/0001_core/);

    expect(log).toContain('ROLLBACK');
    expect(log).not.toContain('COMMIT');
    expect(log[log.length - 1]).toMatch(/pg_advisory_unlock/);
  });

  it('does nothing when everything is already applied', async () => {
    const { client, log } = fakeClient({ applied: LEGACY_BASELINE });

    const result = await runMigrations(client, core);

    expect(result).toEqual({ applied: [], baselined: [] });
    expect(log).not.toContain('BEGIN');
  });
});
