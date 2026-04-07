// Data Sharing API — Frictionless Data Package generation + IPFS P2P sharing
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';
import { ipfsService } from '$lib/services/ipfsService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PACKAGES_DIR = process.env.PACKAGES_DIR || '/data/packages';
const MAX_EXPORT_ROWS = parseInt(process.env.MAX_EXPORT_ROWS || '500000');

// Ensure IPFS registry table exists
let registryInitialized = false;
async function ensureRegistryTable() {
  if (registryInitialized) return;
  try {
    await postgresPool.query(`
      CREATE TABLE IF NOT EXISTS ipfs_published_packages (
        id SERIAL PRIMARY KEY,
        dataset_id INTEGER,
        package_id VARCHAR(255) NOT NULL,
        cid VARCHAR(255) NOT NULL UNIQUE,
        gateway_url TEXT NOT NULL,
        package_name VARCHAR(255),
        description TEXT,
        row_count BIGINT DEFAULT 0,
        file_size_bytes BIGINT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'published',
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_by VARCHAR(255),
        metadata JSONB DEFAULT '{}'
      )
    `);
    registryInitialized = true;
  } catch (e) {
    console.error('Failed to create IPFS registry table:', e);
  }
}

function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * GET /api/data-sharing — list available shared packages or get a specific one
 */
export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action') || 'list';
  const packageId = url.searchParams.get('id');

  if (action === 'list') {
    // List all generated packages
    try {
      const packagesDir = PACKAGES_DIR;
      if (!fs.existsSync(packagesDir)) {
        return json({ success: true, packages: [] });
      }

      const dirs = fs.readdirSync(packagesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => {
          const pkgPath = path.join(packagesDir, d.name, 'datapackage.json');
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
              return {
                id: d.name,
                name: pkg.name,
                title: pkg.title,
                description: pkg.description,
                version: pkg.version,
                created: pkg.created,
                resources: pkg.resources?.length || 0,
                totalRows: pkg.social_explorer?.total_rows || 0,
                previewRows: pkg.social_explorer?.preview_rows || 0,
              };
            } catch { return null; }
          }
          return null;
        })
        .filter(Boolean);

      return json({ success: true, packages: dirs });
    } catch (err: any) {
      return json({ success: false, error: err.message }, { status: 500 });
    }
  }

  if (action === 'get' && packageId) {
    const pkgPath = path.join(PACKAGES_DIR, packageId, 'datapackage.json');
    if (!fs.existsSync(pkgPath)) {
      return json({ success: false, error: 'Package not found' }, { status: 404 });
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    // Also load preview data if available
    let preview: any[] = [];
    const previewResource = pkg.resources?.find((r: any) => r.name.endsWith('-preview'));
    if (previewResource) {
      const previewPath = path.join(PACKAGES_DIR, packageId, previewResource.path);
      if (fs.existsSync(previewPath)) {
        const csvContent = fs.readFileSync(previewPath, 'utf-8');
        const lines = csvContent.split('\n').filter(l => l.trim());
        if (lines.length > 1) {
          const headers = lines[0].split(',');
          preview = lines.slice(1, 21).map(line => {
            const values = line.split(',');
            const row: any = {};
            headers.forEach((h, i) => { row[h] = values[i]; });
            return row;
          });
        }
      }
    }

    return json({ success: true, datapackage: pkg, preview });
  }

  if (action === 'registry') {
    try {
      await ensureRegistryTable();
      const packages = await postgresPool.query(
        'SELECT * FROM ipfs_published_packages WHERE status = $1 ORDER BY published_at DESC',
        ['published']
      );
      return json({ success: true, packages });
    } catch (err: any) {
      return json({ success: false, error: err.message }, { status: 500 });
    }
  }

  if (action === 'resolve') {
    const cid = url.searchParams.get('cid');
    if (!cid) return json({ success: false, error: 'cid parameter required' }, { status: 400 });
    try {
      await ensureRegistryTable();
      const rows = await postgresPool.query(
        'SELECT * FROM ipfs_published_packages WHERE cid = $1',
        [cid]
      );
      if (rows.length === 0) {
        return json({ success: true, found: false, gateway_url: ipfsService.getGatewayUrl(cid) });
      }
      return json({ success: true, found: true, package: rows[0] });
    } catch (err: any) {
      return json({ success: false, error: err.message }, { status: 500 });
    }
  }

  return json({ success: false, error: 'Invalid action' }, { status: 400 });
};

/**
 * POST /api/data-sharing — generate a new data package
 */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { action: postAction, dataset_id, dataset_name, table_name, schema_name, preview_rows } = body;

  // ── IPFS Publish ──────────────────────────────────────────────────────────
  if (postAction === 'publish') {
    const packageId = body.package_id;
    if (!packageId) return json({ success: false, error: 'package_id required' }, { status: 400 });

    try {
      await ensureRegistryTable();

      const pkgPath = path.join(PACKAGES_DIR, packageId, 'datapackage.json');
      if (!fs.existsSync(pkgPath)) {
        return json({ success: false, error: 'Package not found' }, { status: 404 });
      }

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const schemaName = pkg.social_explorer?.source_schema || 'public';
      const tableName = pkg.social_explorer?.source_table;
      const packageDir = path.join(PACKAGES_DIR, packageId);

      // Export full dataset as CSV (batched to avoid memory issues)
      if (tableName) {
        const countResult = await postgresPool.query(
          `SELECT COUNT(*) as count FROM ${schemaName}.${tableName}`
        );
        const rowCount = Math.min(parseInt(countResult[0]?.count || '0'), MAX_EXPORT_ROWS);

        const columns = await postgresPool.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
          [schemaName, tableName]
        );
        const headers = columns.map((c: any) => c.column_name);
        const fullCsvPath = path.join(packageDir, `${tableName}.csv`);

        const csvLines: string[] = [headers.map(csvEscape).join(',')];
        const BATCH_SIZE = 10000;
        let offset = 0;

        while (offset < rowCount) {
          const batch = await postgresPool.query(
            `SELECT * FROM ${schemaName}.${tableName} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
          );
          for (const row of batch) {
            csvLines.push(headers.map(h => csvEscape(row[h])).join(','));
          }
          offset += BATCH_SIZE;
        }

        fs.writeFileSync(fullCsvPath, csvLines.join('\n'));
        console.log(`Exported ${rowCount} rows to ${fullCsvPath}`);
      }

      // Publish directory to IPFS
      const cid = await ipfsService.publishDirectory(packageDir);
      const gatewayUrl = ipfsService.getGatewayUrl(cid);

      // Calculate total file size
      const files = fs.readdirSync(packageDir);
      const totalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(packageDir, f)).size, 0);

      // Register in database
      await postgresPool.query(`
        INSERT INTO ipfs_published_packages (dataset_id, package_id, cid, gateway_url, package_name, description, row_count, file_size_bytes, status, published_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', 'current_user')
        ON CONFLICT (cid) DO UPDATE SET status = 'published', published_at = CURRENT_TIMESTAMP
      `, [
        pkg.social_explorer?.dataset_id || null,
        packageId,
        cid,
        gatewayUrl,
        pkg.title || packageId,
        pkg.description || '',
        pkg.social_explorer?.total_rows || 0,
        totalSize
      ]);

      return json({ success: true, cid, gateway_url: gatewayUrl, package_id: packageId });
    } catch (err: any) {
      console.error('IPFS publish error:', err);
      return json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // ── IPFS Import ───────────────────────────────────────────────────────────
  if (postAction === 'import') {
    const cid = body.cid;
    if (!cid) return json({ success: false, error: 'cid required' }, { status: 400 });

    try {
      await ensureRegistryTable();

      // Fetch from IPFS to temp directory
      const tempDir = path.join(os.tmpdir(), `ipfs-import-${Date.now()}`);
      const filenames = await ipfsService.fetchDirectory(cid, tempDir);

      // Validate it's a Frictionless Data Package
      const pkgPath = path.join(tempDir, 'datapackage.json');
      if (!fs.existsSync(pkgPath)) {
        fs.rmSync(tempDir, { recursive: true });
        return json({ success: false, error: 'Not a valid Frictionless Data Package — no datapackage.json found' }, { status: 422 });
      }

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      // Find the main data resource (not preview)
      const dataResource = pkg.resources?.find((r: any) => !r.name.endsWith('-preview') && r.format === 'csv');
      if (!dataResource) {
        fs.rmSync(tempDir, { recursive: true });
        return json({ success: false, error: 'No CSV data resource found in package' }, { status: 422 });
      }

      const csvPath = path.join(tempDir, dataResource.path);
      if (!fs.existsSync(csvPath)) {
        fs.rmSync(tempDir, { recursive: true });
        return json({ success: false, error: `CSV file ${dataResource.path} not found in package` }, { status: 422 });
      }

      // Create table from Frictionless schema
      const fields = dataResource.schema?.fields || [];
      const reverseTypeMap: Record<string, string> = {
        'integer': 'BIGINT', 'number': 'DOUBLE PRECISION', 'boolean': 'BOOLEAN',
        'string': 'TEXT', 'datetime': 'TIMESTAMP', 'date': 'DATE',
        'object': 'JSONB', 'array': 'JSONB',
      };

      const sanitizedName = `ipfs_${cid.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '_')}`;
      const columnDefs = fields.map((f: any) => `"${f.name}" ${reverseTypeMap[f.type] || 'TEXT'}`).join(', ');

      await postgresPool.query(`CREATE TABLE IF NOT EXISTS ${sanitizedName} (${columnDefs})`);

      // Parse and insert CSV in batches
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
      let insertedRows = 0;

      const BATCH = 1000;
      for (let i = 1; i < lines.length; i += BATCH) {
        const batch = lines.slice(i, Math.min(i + BATCH, lines.length));
        const values: any[][] = [];
        for (const line of batch) {
          const vals = line.split(',').map(v => {
            const trimmed = v.replace(/^"|"$/g, '').trim();
            return trimmed === '' ? null : trimmed;
          });
          values.push(vals);
        }

        if (values.length > 0) {
          const placeholders = values.map((row, ri) =>
            `(${row.map((_, ci) => `$${ri * row.length + ci + 1}`).join(',')})`
          ).join(',');
          const flatValues = values.flat();
          const colNames = headers.map(h => `"${h}"`).join(',');

          await postgresPool.query(
            `INSERT INTO ${sanitizedName} (${colNames}) VALUES ${placeholders}`,
            flatValues
          );
          insertedRows += values.length;
        }
      }

      // Register as dataset
      await postgresPool.query(`
        INSERT INTO datasets (name, description, dataset_type, source_platform, table_name, schema_name, record_count, status, created_at)
        VALUES ($1, $2, 'imported', 'ipfs', $3, 'public', $4, 'active', CURRENT_TIMESTAMP)
      `, [
        pkg.title || `IPFS Import ${cid.slice(0, 8)}`,
        pkg.description || `Imported from IPFS CID ${cid}`,
        sanitizedName,
        insertedRows
      ]);

      // Copy to local packages dir
      const localPkgDir = path.join(PACKAGES_DIR, sanitizedName);
      fs.mkdirSync(localPkgDir, { recursive: true });
      for (const f of filenames) {
        fs.copyFileSync(path.join(tempDir, f), path.join(localPkgDir, f));
      }

      // Record in registry
      await postgresPool.query(`
        INSERT INTO ipfs_published_packages (package_id, cid, gateway_url, package_name, description, row_count, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'imported')
        ON CONFLICT (cid) DO NOTHING
      `, [sanitizedName, cid, ipfsService.getGatewayUrl(cid), pkg.title || 'Imported', pkg.description || '', insertedRows]);

      // Cleanup temp
      fs.rmSync(tempDir, { recursive: true });

      return json({
        success: true,
        table_name: sanitizedName,
        row_count: insertedRows,
        fields: fields.length,
        cid,
        package_title: pkg.title
      });
    } catch (err: any) {
      console.error('IPFS import error:', err);
      return json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // ── Generate package (original flow) ──────────────────────────────────────
  try {
    let tableName = table_name;
    let schemaName = schema_name || 'public';
    let dsName = dataset_name || '';
    let dsDescription = '';

    // If dataset_id provided, look up from catalog
    if (dataset_id) {
      const rows = await postgresPool.query(
        'SELECT name, description, table_name, schema_name FROM datasets WHERE id = $1',
        [dataset_id]
      );
      if (rows.length === 0) {
        return json({ success: false, error: 'Dataset not found' }, { status: 404 });
      }
      tableName = rows[0].table_name;
      schemaName = rows[0].schema_name || 'public';
      dsName = rows[0].name;
      dsDescription = rows[0].description || '';
    }

    if (!tableName) {
      return json({ success: false, error: 'No table_name specified' }, { status: 400 });
    }

    // Infer schema from PostgreSQL
    const columns = await postgresPool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schemaName, tableName]
    );

    const typeMap: Record<string, string> = {
      'integer': 'integer', 'bigint': 'integer', 'smallint': 'integer',
      'real': 'number', 'double precision': 'number', 'numeric': 'number',
      'boolean': 'boolean', 'text': 'string', 'character varying': 'string',
      'timestamp without time zone': 'datetime', 'timestamp with time zone': 'datetime',
      'date': 'date', 'jsonb': 'object', 'json': 'object',
    };

    const fields = columns.map((col: any) => ({
      name: col.column_name,
      type: typeMap[col.data_type] || 'string',
      ...(col.is_nullable === 'NO' ? { constraints: { required: true } } : {})
    }));

    // Get row count
    const countResult = await postgresPool.query(
      `SELECT COUNT(*) as count FROM ${schemaName}.${tableName}`
    );
    const rowCount = parseInt(countResult[0]?.count || '0');

    // Get preview rows
    const limit = preview_rows || 100;
    const previewData = await postgresPool.query(
      `SELECT * FROM ${schemaName}.${tableName} LIMIT $1`,
      [limit]
    );

    // Build package ID
    const packageId = (dsName || tableName).toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Build datapackage
    const datapackage = {
      name: packageId,
      title: dsName || tableName,
      description: dsDescription || `Dataset from Social Explorer (${rowCount.toLocaleString()} records)`,
      version: '1.0.0',
      created: new Date().toISOString(),
      licenses: [{ name: 'CC-BY-4.0', path: 'https://creativecommons.org/licenses/by/4.0/', title: 'Creative Commons Attribution 4.0' }],
      contributors: [{ title: 'Social Explorer', role: 'publisher' }],
      resources: [
        {
          name: tableName,
          path: `${tableName}.csv`,
          format: 'csv',
          schema: { fields },
          row_count: rowCount,
          description: `Full dataset (${rowCount.toLocaleString()} records)`
        },
        {
          name: `${tableName}-preview`,
          path: `${tableName}-preview.csv`,
          format: 'csv',
          schema: { fields },
          row_count: previewData.length,
          description: `Preview: first ${previewData.length} rows`
        }
      ],
      social_explorer: {
        source_schema: schemaName,
        source_table: tableName,
        total_rows: rowCount,
        preview_rows: previewData.length
      }
    };

    // Save to filesystem
    const outputDir = path.join(PACKAGES_DIR, packageId);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'datapackage.json'), JSON.stringify(datapackage, null, 2));

    // Write preview CSV
    if (previewData.length > 0 && fields.length > 0) {
      const headers = fields.map((f: any) => f.name);
      const csvLines = [headers.join(',')];
      for (const row of previewData) {
        csvLines.push(headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','));
      }
      fs.writeFileSync(path.join(outputDir, `${tableName}-preview.csv`), csvLines.join('\n'));
    }

    return json({
      success: true,
      package_id: packageId,
      datapackage,
      preview: previewData.slice(0, 20),
      output_dir: outputDir
    });

  } catch (err: any) {
    console.error('Data sharing error:', err);
    return json({ success: false, error: err.message }, { status: 500 });
  }
};
