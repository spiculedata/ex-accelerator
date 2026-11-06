import { describe, it, expect } from 'vitest';
import { LEGACY_BASELINE, planMigrations, runMigrations, type Migration, type MigrationClient } from './runner';

const m = (name: string): Migration => ({ name, sql: `-- ${name}` });
const legacyNames = Object.keys(LEGACY_BASELINE);
const core = legacyNames.map(m);
const sentinels = Object.values(LEGACY_BASELINE);

describe('planMigrations', () => {
  it('runs everything on a fresh database', () => {
    const plan = planMigrations(core, [], []);

    expect(plan.toRun.map((x) => x.name)).toEqual(legacyNames);
    expect(plan.toBaseline).toEqual([]);
  });

  it('baselines legacy migrations whose tables already exist, and runs later ones', () => {
    const plan = planMigrations([...core, m('0004_new')], [], sentinels);

    expect(plan.toBaseline).toEqual(legacyNames);
    expect(plan.toRun.map((x) => x.name)).toEqual(['0004_new']);
  });

  it('baselines each legacy migration on its own sentinel table (partial installs)', () => {
    const plan = planMigrations(core, [], [LEGACY_BASELINE['0001_core']]);

    expect(plan.toBaseline).toEqual(['0001_core']);
    expect(plan.toRun.map((x) => x.name)).toEqual(['0002_projects_workspaces', '0003_datasets']);
  });

  it('baselines a later legacy migration even when an earlier one is missing', () => {
    const plan = planMigrations(core, [], [LEGACY_BASELINE['0002_projects_workspaces']]);

    expect(plan.toBaseline).toEqual(['0002_projects_workspaces']);
    expect(plan.toRun.map((x) => x.name)).toEqual(['0001_core', '0003_datasets']);
  });

  it('skips migrations that were already applied', () => {
    const plan = planMigrations([...core, m('0004_new')], legacyNames, []);

    expect(plan.toRun.map((x) => x.name)).toEqual(['0004_new']);
  });

  it('never baselines once migrations have been recorded', () => {
    const plan = planMigrations(core, ['0001_core'], sentinels);

    expect(plan.toBaseline).toEqual([]);
    expect(plan.toRun.map((x) => x.name)).toEqual(legacyNames.slice(1));
  });

  it('orders migrations by name', () => {
    const plan = planMigrations([m('0002_b'), m('0001_a')], [], []);

    expect(plan.toRun.map((x) => x.name)).toEqual(['0001_a', '0002_b']);
  });
});

function fakeClient(
  options: { applied?: string[]; tables?: string[]; failOn?: string; lockAvailable?: boolean; rollbackFails?: boolean } = {}
) {
  const log: string[] = [];
  const client: MigrationClient = {
    async query(text: string, values?: unknown[]) {
      log.push(text.trim().split('\n')[0]);
      if (/FROM schema_migrations/i.test(text)) {
        return { rows: (options.applied ?? []).map((name) => ({ name })) };
      }
      if (/pg_try_advisory_lock/i.test(text)) return { rows: [{ locked: options.lockAvailable ?? true }] };
      if (/to_regclass/i.test(text)) {
        return { rows: [{ present: (options.tables ?? []).includes(String(values?.[0])) }] };
      }
      if (text.trim() === 'ROLLBACK' && options.rollbackFails) throw new Error('connection lost');
      if (options.failOn && text.includes(options.failOn)) throw new Error('boom');
      return { rows: [] };
    }
  };
  return { client, log };
}

const fast = { lockTimeoutMs: 20, lockRetryMs: 5 };

describe('runMigrations', () => {
  it('applies each migration inside its own transaction, then unlocks', async () => {
    const { client, log } = fakeClient();

    const result = await runMigrations(client, [m('0001_core')], fast);

    expect(result).toEqual({ applied: ['0001_core'], baselined: [] });
    const begin = log.indexOf('BEGIN');
    expect(begin).toBeGreaterThan(-1);
    expect(log.slice(begin, begin + 2)).toEqual(['BEGIN', '-- 0001_core']);
    expect(log).toContain('COMMIT');
    expect(log[log.length - 1]).toMatch(/pg_advisory_unlock/);
  });

  it('records existing legacy tables as baselined without executing their SQL', async () => {
    const { client, log } = fakeClient({ tables: sentinels });

    const result = await runMigrations(client, core, fast);

    expect(result.baselined).toEqual(legacyNames);
    expect(result.applied).toEqual([]);
    expect(log.some((line) => line.startsWith('-- 000'))).toBe(false);
    expect(log).not.toContain('BEGIN');
  });

  it('rolls back, names the failing migration and still unlocks', async () => {
    const { client, log } = fakeClient({ failOn: '-- 0001_core' });

    await expect(runMigrations(client, [m('0001_core')], fast)).rejects.toThrow(/0001_core.*boom/);

    expect(log).toContain('ROLLBACK');
    expect(log).not.toContain('COMMIT');
    expect(log[log.length - 1]).toMatch(/pg_advisory_unlock/);
  });

  it('keeps the migration error when the rollback itself fails', async () => {
    const { client } = fakeClient({ failOn: '-- 0001_core', rollbackFails: true });

    await expect(runMigrations(client, [m('0001_core')], fast)).rejects.toThrow(/0001_core.*boom/);
  });

  it('does nothing when everything is already applied', async () => {
    const { client, log } = fakeClient({ applied: legacyNames });

    const result = await runMigrations(client, core, fast);

    expect(result).toEqual({ applied: [], baselined: [] });
    expect(log).not.toContain('BEGIN');
  });

  it('gives up with a clear error when the lock cannot be acquired in time', async () => {
    const { client, log } = fakeClient({ lockAvailable: false });

    await expect(runMigrations(client, core, fast)).rejects.toThrow(/lock/i);

    expect(log).not.toContain('BEGIN');
    expect(log.some((line) => /pg_advisory_unlock/.test(line))).toBe(false);
  });
});
