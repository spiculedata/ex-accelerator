import type { Cell, DemoTable } from './types';

export interface InsertStatement {
  text: string;
  values: Cell[];
}

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function assertIdentifier(value: string): void {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
}

/** Splits a table into parameterised multi-row INSERTs that stay under PostgreSQL's parameter limit. */
export function toInsertStatements(table: DemoTable, maxParams = 60_000): InsertStatement[] {
  assertIdentifier(table.name);
  table.columns.forEach(assertIdentifier);
  const rowsPerBatch = Math.max(1, Math.floor(maxParams / table.columns.length));
  const statements: InsertStatement[] = [];

  for (let start = 0; start < table.rows.length; start += rowsPerBatch) {
    const batch = table.rows.slice(start, start + rowsPerBatch);
    const placeholders = batch
      .map((_, rowIndex) => `(${table.columns.map((__, col) => `$${rowIndex * table.columns.length + col + 1}`).join(', ')})`)
      .join(', ');
    statements.push({
      text: `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES ${placeholders}`,
      values: batch.flat()
    });
  }
  return statements;
}
