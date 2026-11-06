import { describe, it, expect } from 'vitest';
import { toInsertStatements } from './insertStatements';

describe('toInsertStatements', () => {
  const table = { name: 'things', columns: ['id', 'label'], rows: [[1, 'a'], [2, 'b'], [3, 'c']] };

  it('builds one parameterised multi-row insert', () => {
    const [statement] = toInsertStatements(table, 100);

    expect(statement.text).toBe('INSERT INTO things (id, label) VALUES ($1, $2), ($3, $4), ($5, $6)');
    expect(statement.values).toEqual([1, 'a', 2, 'b', 3, 'c']);
  });

  it('splits into batches that respect the parameter limit', () => {
    const statements = toInsertStatements(table, 4);

    expect(statements).toHaveLength(2);
    expect(statements[0].values).toEqual([1, 'a', 2, 'b']);
    expect(statements[1].values).toEqual([3, 'c']);
  });

  it('sends dates as UTC ISO strings so the stored time does not depend on the machine timezone', () => {
    const when = new Date('2026-06-15T12:30:00Z');
    const [statement] = toInsertStatements({ name: 'events', columns: ['id', 'at'], rows: [[1, when]] }, 100);

    expect(statement.values).toEqual([1, '2026-06-15T12:30:00.000Z']);
  });

  it('returns nothing for an empty table', () => {
    expect(toInsertStatements({ ...table, rows: [] }, 100)).toEqual([]);
  });

  it('rejects unsafe identifiers', () => {
    expect(() => toInsertStatements({ ...table, name: 'x; DROP TABLE y' }, 100)).toThrow(/identifier/i);
    expect(() => toInsertStatements({ ...table, columns: ['id', 'a b'] }, 100)).toThrow(/identifier/i);
  });
});
