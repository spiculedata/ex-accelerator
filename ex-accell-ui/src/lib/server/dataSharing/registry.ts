// The registry of packages this install has published to, or imported from, IPFS. The table
// (ipfs_published_packages) is created by db/migrations/0007_ipfs_registry.sql.

import { postgresPool } from '$lib/services/postgres';

const PUBLIC_COLUMNS = 'id, dataset_id, package_id, cid, gateway_url, package_name, description, row_count, file_size_bytes, status, published_at, metadata';

/** Published packages, newest first. Who published is shown to admins only. */
export async function listPublished(includePublisher: boolean): Promise<unknown[]> {
  const columns = includePublisher ? `${PUBLIC_COLUMNS}, published_by` : PUBLIC_COLUMNS;
  return postgresPool.query(`SELECT ${columns} FROM ipfs_published_packages WHERE status = $1 ORDER BY published_at DESC`, ['published']);
}

export async function findByCid(cid: string): Promise<{ status: string; package_id: string } | null> {
  const rows = await postgresPool.query(`SELECT ${PUBLIC_COLUMNS} FROM ipfs_published_packages WHERE cid = $1`, [cid]);
  return rows[0] ?? null;
}

export interface PublishedRecord {
  datasetId: number | null;
  packageId: string;
  cid: string;
  gatewayUrl: string;
  name: string;
  description: string;
  rowCount: number;
  fileSizeBytes: number;
  publishedBy: string | null;
}

export async function recordPublished(record: PublishedRecord): Promise<void> {
  await postgresPool.query(
    `INSERT INTO ipfs_published_packages
       (dataset_id, package_id, cid, gateway_url, package_name, description, row_count, file_size_bytes, status, published_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $9)
     ON CONFLICT (cid) DO UPDATE SET
       dataset_id = EXCLUDED.dataset_id, package_id = EXCLUDED.package_id, gateway_url = EXCLUDED.gateway_url,
       package_name = EXCLUDED.package_name, description = EXCLUDED.description, row_count = EXCLUDED.row_count,
       file_size_bytes = EXCLUDED.file_size_bytes, status = 'published', published_at = CURRENT_TIMESTAMP,
       published_by = EXCLUDED.published_by`,
    [
      record.datasetId,
      record.packageId,
      record.cid,
      record.gatewayUrl,
      record.name,
      record.description,
      record.rowCount,
      record.fileSizeBytes,
      record.publishedBy
    ]
  );
}

export interface ImportedRecord {
  packageId: string;
  cid: string;
  gatewayUrl: string;
  name: string;
  description: string;
  rowCount: number;
  importedBy: string | null;
}

export async function recordImported(record: ImportedRecord): Promise<void> {
  await postgresPool.query(
    `INSERT INTO ipfs_published_packages (package_id, cid, gateway_url, package_name, description, row_count, status, published_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'imported', $7)
     ON CONFLICT (cid) DO NOTHING`,
    [record.packageId, record.cid, record.gatewayUrl, record.name, record.description, record.rowCount, record.importedBy]
  );
}
