// Importing a Frictionless Data Package fetched from IPFS into a new table. Everything in the package is
// untrusted: names are checked before they reach SQL or the file system, and rows are inserted with parameters.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { postgresPool } from '$lib/services/postgres';
import { ipfsService } from '$lib/services/ipfsService';
import { parseCsv } from './csv';
import { conflict, unprocessable } from './errors';
import { isSafePackageFileName, isSafeSqlIdentifier, quoteIdentifier } from './identifiers';
import { packageDir, writeDataPackage, type DataPackage } from './packages';
import { findByCid, recordImported } from './registry';

// Postgres allows 65,535 parameters in one statement
const MAX_QUERY_PARAMETERS = 65_535;
const MAX_INSERT_BATCH_ROWS = 1000;
const MAX_IMPORT_ROWS = Number(process.env.MAX_EXPORT_ROWS) > 0 ? Number(process.env.MAX_EXPORT_ROWS) : 500_000;
// Postgres identifiers are at most 63 characters: "ipfs_" plus the tail of the CID, where CIDs differ
const TABLE_NAME_CID_CHARS = 40;
const SHORT_CID_CHARS = 8;
// Postgres: invalid text representation, invalid datetime format, datetime field overflow, duplicate table
const BAD_VALUE_CODES = new Set(['22P02', '22007', '22008']);
const DUPLICATE_TABLE_CODE = '42P07';

const POSTGRES_TYPES: Record<string, string> = {
  integer: 'BIGINT',
  number: 'DOUBLE PRECISION',
  boolean: 'BOOLEAN',
  string: 'TEXT',
  datetime: 'TIMESTAMP',
  date: 'DATE',
  object: 'JSONB',
  array: 'JSONB'
};

interface ImportedResource {
  name?: string;
  path?: string;
  format?: string;
  schema?: { fields?: { name?: unknown; type?: unknown }[] };
}

interface ImportedPackage {
  title?: unknown;
  description?: unknown;
  resources?: ImportedResource[];
}

export interface ImportResult {
  tableName: string;
  rowCount: number;
  fieldCount: number;
  title: string | null;
}

/** The name of the table an import lands in: derived from the CID, so it is always a plain identifier. */
export function importTableName(cid: string): string {
  return `ipfs_${cid.slice(-TABLE_NAME_CID_CHARS).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

function readPackageFile(dir: string, filenames: string[]): ImportedPackage {
  if (!filenames.includes('datapackage.json')) throw unprocessable('Not a Frictionless Data Package: no datapackage.json found');
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'datapackage.json'), 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as ImportedPackage;
  } catch {
    throw unprocessable('datapackage.json is not valid JSON');
  }
}

function dataResourceOf(pkg: ImportedPackage, filenames: string[]): { path: string; fields: { name: string; type: string }[] } {
  const resource = (pkg.resources ?? []).find((candidate) => !String(candidate?.name ?? '').endsWith('-preview') && candidate?.format === 'csv');
  if (!resource) throw unprocessable('No CSV data resource found in the package');
  if (!isSafePackageFileName(resource.path) || !filenames.includes(resource.path)) {
    throw unprocessable('The data resource does not name a file in the package');
  }
  const rawFields = resource.schema?.fields ?? [];
  if (rawFields.length === 0) throw unprocessable('The data resource declares no fields');
  const fields = rawFields.map((field) => {
    if (!isSafeSqlIdentifier(field?.name)) throw unprocessable('A field name in the package is not a plain identifier');
    return { name: field.name, type: POSTGRES_TYPES[String(field?.type)] ?? 'TEXT' };
  });
  if (new Set(fields.map((field) => field.name)).size !== fields.length) throw unprocessable('The package repeats a field name');
  return { path: resource.path, fields };
}

function rowsOf(csvPath: string, fieldNames: string[]): (string | null)[][] {
  const [headers, ...rows] = parseCsv(fs.readFileSync(csvPath, 'utf-8'), { maxRows: MAX_IMPORT_ROWS + 1 });
  if (!headers || headers.join('\0') !== fieldNames.join('\0')) throw unprocessable('The CSV header does not match the declared fields');
  return rows.map((row) => {
    if (row.length !== fieldNames.length) throw unprocessable('A CSV row has a different number of values than the header');
    return row.map((value) => (value.trim() === '' ? null : value));
  });
}

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

async function insertRows(client: Queryable, tableName: string, fieldNames: string[], rows: (string | null)[][]): Promise<void> {
  const columns = fieldNames.map(quoteIdentifier).join(',');
  const batchRows = Math.max(1, Math.min(MAX_INSERT_BATCH_ROWS, Math.floor(MAX_QUERY_PARAMETERS / fieldNames.length)));
  for (let start = 0; start < rows.length; start += batchRows) {
    const batch = rows.slice(start, start + batchRows);
    const placeholders = batch
      .map((row, rowIndex) => `(${row.map((_, columnIndex) => `$${rowIndex * fieldNames.length + columnIndex + 1}`).join(',')})`)
      .join(',');
    await client.query(`INSERT INTO ${quoteIdentifier(tableName)} (${columns}) VALUES ${placeholders}`, batch.flat());
  }
}

/** A Postgres failure caused by the package's own contents, as a 4xx; anything else is rethrown. */
function translateDatabaseError(error: unknown): never {
  const code = (error as { code?: unknown })?.code;
  if (BAD_VALUE_CODES.has(String(code))) throw unprocessable('A value in the CSV does not match its declared field type');
  if (code === DUPLICATE_TABLE_CODE) throw conflict('This package has already been imported');
  throw error;
}

/** The descriptor saved locally: the remote's own `social_explorer` block is dropped so it can never name a local table. */
function localDescriptor(pkg: ImportedPackage): DataPackage {
  const { social_explorer: _ignored, ...rest } = pkg as DataPackage & { social_explorer?: unknown };
  return rest as DataPackage;
}

/** Fetches a package by CID, validates it, loads it into a new table and catalogues it. Refuses a CID already imported. */
export async function importFromCid(cid: string, importedBy: string | null): Promise<ImportResult> {
  if ((await findByCid(cid))?.status === 'imported') throw conflict('This package has already been imported');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipfs-import-'));
  try {
    const filenames = await ipfsService.fetchDirectory(cid, tempDir);
    const pkg = readPackageFile(tempDir, filenames);
    const resource = dataResourceOf(pkg, filenames);
    const fieldNames = resource.fields.map((field) => field.name);
    const rows = rowsOf(path.join(tempDir, resource.path), fieldNames);

    const tableName = importTableName(cid);
    const title = typeof pkg.title === 'string' && pkg.title.trim() ? pkg.title.trim() : null;
    const description = typeof pkg.description === 'string' ? pkg.description : `Imported from IPFS CID ${cid}`;
    const catalogueName = `${title ?? 'IPFS import'} (${cid.slice(-SHORT_CID_CHARS)})`;
    const columnDefs = resource.fields.map((field) => `${quoteIdentifier(field.name)} ${field.type}`).join(', ');

    // Table, rows and catalogue entry land together or not at all
    await postgresPool
      .transaction(async (client) => {
        await client.query(`CREATE TABLE ${quoteIdentifier(tableName)} (${columnDefs})`);
        await insertRows(client, tableName, fieldNames, rows);
        await client.query(
          `INSERT INTO datasets (name, description, dataset_type, source_platform, source_database, table_name, schema_name, record_count, status, created_by, created_at)
           VALUES ($1, $2, 'imported', 'ipfs', 'postgres', $3, 'public', $4, 'available', $5, CURRENT_TIMESTAMP)`,
          [catalogueName, description, tableName, rows.length, importedBy]
        );
      })
      .catch(translateDatabaseError);

    const localDir = packageDir(tableName);
    fs.mkdirSync(localDir, { recursive: true });
    for (const filename of filenames.filter((name) => name !== 'datapackage.json')) {
      fs.copyFileSync(path.join(tempDir, filename), path.join(localDir, filename));
    }
    writeDataPackage(localDir, localDescriptor(pkg));

    await recordImported({
      packageId: tableName,
      cid,
      gatewayUrl: ipfsService.getGatewayUrl(cid),
      name: title ?? 'Imported',
      description,
      rowCount: rows.length,
      importedBy
    });

    return { tableName, rowCount: rows.length, fieldCount: resource.fields.length, title };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
