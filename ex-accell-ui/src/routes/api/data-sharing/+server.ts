// Data Sharing API: Frictionless Data Packages on disk, published to and imported from IPFS.
// Reads are open to every signed-in role; POST (generate, publish, import) is admin-only (see auth/guard.ts).
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';
import { ipfsService } from '$lib/services/ipfsService';
import { isValidCid } from '$lib/services/ipfsCid';
import { InvalidCidError, IpfsDisabledError, PackageTooLargeError, UnsafePackageError } from '$lib/services/ipfsErrors';
import { NetworkConfigError } from '$lib/services/ipfsNetworkConfig';
import { parseResourceId } from '$lib/server/auth/access';
import { createLogger } from '$lib/utils/logger';
import { DataSharingError, badRequest, notFound, unprocessable } from '$lib/server/dataSharing/errors';
import { importFromCid } from '$lib/server/dataSharing/importPackage';
import {
  checkSourceTable,
  describeExport,
  exportFullCsv,
  generatePackage,
  listPackages,
  packageDir,
  packageSizeBytes,
  readDataPackage,
  readPackage,
  writeDataPackage
} from '$lib/server/dataSharing/packages';
import { findByCid, listPublished, recordPublished } from '$lib/server/dataSharing/registry';

const log = createLogger('data-sharing-api');

const fail = (status: number, error: string) => json({ success: false, error }, { status });

/** 4xx for a caller's mistake or a refused package, 503 when sharing is off, 504 for a fetch that timed out; else a generic 500. */
function errorResponse(label: string, error: unknown): Response {
  if (error instanceof DataSharingError) return fail(error.status, error.message);
  if (error instanceof IpfsDisabledError || error instanceof NetworkConfigError) return fail(503, error.message);
  if (error instanceof InvalidCidError) return fail(400, error.message);
  if (error instanceof UnsafePackageError || error instanceof PackageTooLargeError) return fail(422, error.message);
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return fail(504, 'The package could not be fetched from the IPFS network in time');
  }
  log.error(`${label} failed`, { detail: error instanceof Error ? error.message : String(error) });
  return fail(500, 'Request failed');
}

function requireEnabled(): void {
  if (!ipfsService.isEnabled()) throw new IpfsDisabledError();
}

export const GET: RequestHandler = async ({ url, locals }) => {
  const action = url.searchParams.get('action') || 'list';
  try {
    switch (action) {
      case 'status':
        return json({ success: true, data: { enabled: ipfsService.isEnabled(), connected: ipfsService.isConnected() } });
      case 'list':
        return json({ success: true, packages: listPackages() });
      case 'get':
        return json({ success: true, ...readPackage(url.searchParams.get('id')) });
      case 'registry':
        return json({ success: true, enabled: ipfsService.isEnabled(), packages: await listPublished(locals.user?.role === 'admin') });
      case 'resolve':
        return await resolve(url.searchParams.get('cid'));
      default:
        return fail(400, 'Invalid action');
    }
  } catch (error) {
    return errorResponse(`GET ${action}`, error);
  }
};

async function resolve(cid: string | null): Promise<Response> {
  if (!isValidCid(cid)) throw badRequest('A valid cid parameter is required');
  const found = await findByCid(cid);
  if (!found) return json({ success: true, found: false, gateway_url: ipfsService.getGatewayUrl(cid) });
  return json({ success: true, found: true, package: found });
}

export const POST: RequestHandler = async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail(400, 'Request body must be a JSON object');
    body = parsed as Record<string, unknown>;
  } catch {
    return fail(400, 'Request body must be valid JSON');
  }

  const actor = locals.user?.email ?? null;
  const action = typeof body.action === 'string' ? body.action : 'generate';
  try {
    switch (action) {
      case 'publish':
        return await publish(body.package_id, actor);
      case 'import':
        return await importPackage(body.cid, actor);
      case 'generate':
        return await generate(body);
      default:
        return fail(400, 'Invalid action');
    }
  } catch (error) {
    return errorResponse(`POST ${action}`, error);
  }
};

interface DatasetRow {
  name: string;
  description: string | null;
  table_name: string;
  schema_name: string | null;
}

/** The catalogue row a package was generated from; the table to export always comes from here, never from the descriptor. */
async function catalogueDataset(datasetId: number): Promise<DatasetRow> {
  const rows = await postgresPool.query<DatasetRow>('SELECT name, description, table_name, schema_name FROM datasets WHERE id = $1', [datasetId]);
  if (rows.length === 0) throw notFound('Dataset not found');
  return rows[0];
}

/**
 * Exports the package's table in full, publishes the directory to IPFS (public, permanent) and records it. Only a
 * package generated here from a catalogued dataset can be published: an imported package names no local table.
 */
async function publish(packageId: unknown, publishedBy: string | null): Promise<Response> {
  requireEnabled();
  const dir = packageDir(packageId);
  const pkg = readDataPackage(dir);
  if (!pkg) throw notFound('Package not found');
  const datasetId = parseResourceId(pkg.social_explorer?.dataset_id);
  if (datasetId === null || datasetId === 'invalid') throw unprocessable('Only a package generated from a catalogued dataset can be published');
  const dataset = await catalogueDataset(datasetId);
  const { schema, table } = checkSourceTable(dataset.schema_name || 'public', dataset.table_name);
  if (pkg.social_explorer?.source_table !== table) throw unprocessable('The package no longer matches its dataset; generate it again');

  const exported = await exportFullCsv(dir, schema, table);
  writeDataPackage(dir, describeExport(pkg, table, exported));
  const cid = await ipfsService.publishDirectory(dir);
  const gatewayUrl = ipfsService.getGatewayUrl(cid);
  await recordPublished({
    datasetId,
    packageId: packageId as string,
    cid,
    gatewayUrl,
    name: pkg.title || (packageId as string),
    description: pkg.description || '',
    rowCount: exported.rows,
    fileSizeBytes: packageSizeBytes(dir),
    publishedBy
  });
  log.info('Published package to IPFS', { packageId, cid, rows: exported.rows, publishedBy });
  return json({ success: true, cid, gateway_url: gatewayUrl, package_id: packageId });
}

async function importPackage(cid: unknown, importedBy: string | null): Promise<Response> {
  requireEnabled();
  if (!isValidCid(cid)) throw badRequest('A valid cid is required');
  const result = await importFromCid(cid, importedBy);
  log.info('Imported package from IPFS', { cid, table: result.tableName, rows: result.rowCount, importedBy });
  return json({
    success: true,
    table_name: result.tableName,
    row_count: result.rowCount,
    fields: result.fieldCount,
    cid,
    package_title: result.title
  });
}

/** Generates a package for a dataset from the catalogue. Only catalogued datasets can be packaged, never a bare table name. */
async function generate(body: Record<string, unknown>): Promise<Response> {
  const datasetId = parseResourceId(body.dataset_id);
  if (datasetId === null || datasetId === 'invalid') throw badRequest('dataset_id must be the id of a catalogued dataset');
  const dataset = await catalogueDataset(datasetId);

  const result = await generatePackage({
    datasetId,
    name: dataset.name,
    description: dataset.description ?? '',
    schema: dataset.schema_name || 'public',
    table: dataset.table_name,
    previewRows: body.preview_rows
  });
  return json({ success: true, package_id: result.packageId, datapackage: result.datapackage, preview: result.preview });
}
