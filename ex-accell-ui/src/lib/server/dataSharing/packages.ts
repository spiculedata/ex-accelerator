// Frictionless Data Packages on this server's disk (PACKAGES_DIR): one directory per package holding
// datapackage.json, a preview CSV and, once exported for publishing, the full CSV.

import fs from 'fs';
import path from 'path';
import { postgresPool } from '$lib/services/postgres';
import { isSafeIdentifier, resolveWithin } from '$lib/utils/pathSafety';
import { packageIdFor } from '$lib/utils/packageId';
import { parseCsv, toCsvLine } from './csv';
import { badRequest, forbidden, notFound, unprocessable } from './errors';
import { clampPreviewRows, isProtectedTable, isSafePackageFileName, isSafeSourceSchema, isSafeSqlIdentifier, qualifiedTable } from './identifiers';

export const PACKAGES_DIR = process.env.PACKAGES_DIR || '/data/packages';
const MAX_EXPORT_ROWS = Number(process.env.MAX_EXPORT_ROWS) > 0 ? Number(process.env.MAX_EXPORT_ROWS) : 500_000;
const EXPORT_BATCH_SIZE = 10_000;
const PREVIEW_RESPONSE_ROWS = 20;

const FRICTIONLESS_TYPES: Record<string, string> = {
  integer: 'integer',
  bigint: 'integer',
  smallint: 'integer',
  real: 'number',
  'double precision': 'number',
  numeric: 'number',
  boolean: 'boolean',
  text: 'string',
  'character varying': 'string',
  'timestamp without time zone': 'datetime',
  'timestamp with time zone': 'datetime',
  date: 'date',
  jsonb: 'object',
  json: 'object'
};

interface PackageField {
  name: string;
  type: string;
  constraints?: { required: true };
}

interface PackageResource {
  name: string;
  path: string;
  format: string;
  schema?: { fields?: PackageField[] };
  row_count?: number;
  description?: string;
}

export interface DataPackage {
  name: string;
  title?: string;
  description?: string;
  version?: string;
  created?: string;
  resources?: PackageResource[];
  social_explorer?: {
    source_schema?: string;
    source_table?: string;
    total_rows?: number;
    preview_rows?: number;
    dataset_id?: number;
    /** Set when MAX_EXPORT_ROWS cut the published CSV short. */
    truncated?: boolean;
  };
}

export interface PackageSummary {
  id: string;
  name: string;
  title?: string;
  description?: string;
  version?: string;
  created?: string;
  resources: number;
  totalRows: number;
  previewRows: number;
  /** Generated here from a catalogued dataset, so it can be published; an imported package cannot. */
  publishable: boolean;
}

/** The directory of a package, refusing any id that is not a plain identifier. */
export function packageDir(packageId: unknown): string {
  if (!isSafeIdentifier(packageId)) throw badRequest('package id must be letters, digits, "-" or "_"');
  return resolveWithin(PACKAGES_DIR, packageId);
}

/** The package's descriptor, or null when there is none or it is not JSON. */
export function readDataPackage(dir: string): DataPackage | null {
  const file = path.join(dir, 'datapackage.json');
  if (!fs.existsSync(file)) return null;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as DataPackage) : null;
  } catch {
    return null;
  }
}

export function writeDataPackage(dir: string, pkg: DataPackage): void {
  fs.writeFileSync(path.join(dir, 'datapackage.json'), JSON.stringify(pkg, null, 2));
}

export function listPackages(): PackageSummary[] {
  if (!fs.existsSync(PACKAGES_DIR)) return [];
  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSafeIdentifier(entry.name))
    .flatMap((entry) => {
      const pkg = readDataPackage(path.join(PACKAGES_DIR, entry.name));
      if (!pkg) return [];
      return [
        {
          id: entry.name,
          name: pkg.name,
          title: pkg.title,
          description: pkg.description,
          version: pkg.version,
          created: pkg.created,
          resources: pkg.resources?.length ?? 0,
          totalRows: pkg.social_explorer?.total_rows ?? 0,
          previewRows: pkg.social_explorer?.preview_rows ?? 0,
          publishable: Number.isInteger(pkg.social_explorer?.dataset_id)
        }
      ];
    });
}

/** The package's descriptor and up to 20 preview rows. The preview file must be a plain file name inside the package. */
export function readPackage(packageId: unknown): { datapackage: DataPackage; preview: Record<string, string>[] } {
  const dir = packageDir(packageId);
  const pkg = readDataPackage(dir);
  if (!pkg) throw notFound('Package not found');

  const previewResource = pkg.resources?.find((resource) => resource.name?.endsWith('-preview'));
  const previewPath = previewResource && isSafePackageFileName(previewResource.path) ? path.join(dir, previewResource.path) : null;
  if (!previewPath || !fs.existsSync(previewPath)) return { datapackage: pkg, preview: [] };

  const [headers, ...rows] = parseCsv(fs.readFileSync(previewPath, 'utf-8'), { maxRows: PREVIEW_RESPONSE_ROWS + 1 });
  const preview = (rows ?? []).map((values) => Object.fromEntries((headers ?? []).map((header, i) => [header, values[i] ?? ''])));
  return { datapackage: pkg, preview };
}

export function checkSourceTable(schema: unknown, table: unknown): { schema: string; table: string } {
  if (!isSafeSourceSchema(schema) || !isSafeSqlIdentifier(table)) throw unprocessable('The dataset names a table this server cannot export');
  if (isProtectedTable(table)) throw forbidden('This table belongs to the application and cannot be shared');
  return { schema, table };
}

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

async function columnsOf(schema: string, table: string): Promise<ColumnRow[]> {
  return postgresPool.query<ColumnRow>(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
    [schema, table]
  );
}

function fieldsOf(columns: ColumnRow[]): PackageField[] {
  return columns.map((column) => ({
    name: column.column_name,
    type: FRICTIONLESS_TYPES[column.data_type] ?? 'string',
    ...(column.is_nullable === 'NO' ? { constraints: { required: true as const } } : {})
  }));
}

async function countRows(schema: string, table: string): Promise<number> {
  const result = await postgresPool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${qualifiedTable(schema, table)}`);
  return Number.parseInt(result[0]?.count ?? '0', 10) || 0;
}

export interface GenerateInput {
  datasetId: number | null;
  name: string;
  description: string;
  schema: string;
  table: string;
  previewRows: unknown;
}

/** Writes datapackage.json and a preview CSV for a dataset, returning the package id, descriptor and a few rows. */
export async function generatePackage(input: GenerateInput) {
  const { schema, table } = checkSourceTable(input.schema, input.table);
  const columns = await columnsOf(schema, table);
  if (columns.length === 0) throw notFound('The dataset table does not exist');

  const fields = fieldsOf(columns);
  const rowCount = await countRows(schema, table);
  const limit = clampPreviewRows(input.previewRows);
  const previewData = await postgresPool.query<Record<string, unknown>>(`SELECT * FROM ${qualifiedTable(schema, table)} LIMIT $1`, [limit]);

  const packageId = packageIdFor(input.name || table, input.datasetId);
  const title = input.name || table;
  const datapackage: DataPackage = {
    name: packageId,
    title,
    description: input.description || `Dataset from Social Explorer (${rowCount.toLocaleString()} records)`,
    version: '1.0.0',
    created: new Date().toISOString(),
    ...{
      licenses: [{ name: 'CC-BY-4.0', path: 'https://creativecommons.org/licenses/by/4.0/', title: 'Creative Commons Attribution 4.0' }],
      contributors: [{ title: 'Social Explorer', role: 'publisher' }]
    },
    resources: [
      { name: table, path: `${table}.csv`, format: 'csv', schema: { fields }, row_count: rowCount, description: `Full dataset (${rowCount.toLocaleString()} records)` },
      { name: `${table}-preview`, path: `${table}-preview.csv`, format: 'csv', schema: { fields }, row_count: previewData.length, description: `Preview: first ${previewData.length} rows` }
    ],
    social_explorer: {
      ...(input.datasetId ? { dataset_id: input.datasetId } : {}),
      source_schema: schema,
      source_table: table,
      total_rows: rowCount,
      preview_rows: previewData.length
    }
  };

  const dir = packageDir(packageId);
  fs.mkdirSync(dir, { recursive: true });
  writeDataPackage(dir, datapackage);
  if (previewData.length > 0 && fields.length > 0) {
    const headers = fields.map((field) => field.name);
    const lines = [toCsvLine(headers), ...previewData.map((row) => toCsvLine(headers.map((header) => row[header])))];
    fs.writeFileSync(path.join(dir, `${table}-preview.csv`), lines.join('\n'));
  }

  return { packageId, datapackage, preview: previewData.slice(0, PREVIEW_RESPONSE_ROWS) };
}

export interface ExportResult {
  /** Rows written to the CSV. */
  rows: number;
  /** Rows in the table; larger than `rows` when the export was cut at MAX_EXPORT_ROWS. */
  totalRows: number;
  fields: PackageField[];
}

/** Exports the table (up to MAX_EXPORT_ROWS) as `<table>.csv` inside the package directory, in batches. */
export async function exportFullCsv(dir: string, schema: string, table: string): Promise<ExportResult> {
  const columns = await columnsOf(schema, table);
  if (columns.length === 0) throw notFound('The dataset table does not exist');
  const totalRows = await countRows(schema, table);
  const limit = Math.min(totalRows, MAX_EXPORT_ROWS);
  const headers = columns.map((column) => column.column_name);
  const file = fs.openSync(path.join(dir, `${table}.csv`), 'w');
  let rows = 0;
  try {
    fs.writeSync(file, toCsvLine(headers));
    for (let offset = 0; offset < limit; offset += EXPORT_BATCH_SIZE) {
      const batch = await postgresPool.query<Record<string, unknown>>(
        `SELECT * FROM ${qualifiedTable(schema, table)} LIMIT $1 OFFSET $2`,
        [Math.min(EXPORT_BATCH_SIZE, limit - offset), offset]
      );
      if (batch.length === 0) break;
      fs.writeSync(file, batch.map((row) => `\n${toCsvLine(headers.map((header) => row[header]))}`).join(''));
      rows += batch.length;
    }
  } finally {
    fs.closeSync(file);
  }
  return { rows, totalRows, fields: fieldsOf(columns) };
}

/** The descriptor brought up to date with what was just exported: current fields, real row counts, truncation. */
export function describeExport(pkg: DataPackage, table: string, exported: ExportResult): DataPackage {
  const truncated = exported.rows < exported.totalRows;
  return {
    ...pkg,
    resources: (pkg.resources ?? []).map((resource) =>
      resource.name === table
        ? {
            ...resource,
            schema: { fields: exported.fields },
            row_count: exported.rows,
            description: truncated
              ? `First ${exported.rows.toLocaleString()} of ${exported.totalRows.toLocaleString()} records`
              : `Full dataset (${exported.rows.toLocaleString()} records)`
          }
        : { ...resource, schema: { fields: exported.fields } }
    ),
    social_explorer: { ...pkg.social_explorer, total_rows: exported.totalRows, ...(truncated ? { truncated: true } : {}) }
  };
}

/** Total size of the regular files directly inside a package directory. */
export function packageSizeBytes(dir: string): number {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .reduce((sum, entry) => sum + fs.statSync(path.join(dir, entry.name)).size, 0);
}
