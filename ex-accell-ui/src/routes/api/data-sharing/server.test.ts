import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IpfsDisabledError, PackageTooLargeError, UnsafePackageError } from '$lib/services/ipfsErrors';
import { NetworkConfigError } from '$lib/services/ipfsNetworkConfig';

// The route reads PACKAGES_DIR and MAX_EXPORT_ROWS when it loads, so both are set before the import below
const PACKAGES_DIR = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? '/tmp'}/data-sharing-test-${process.pid}-${Date.now()}`;
  process.env.PACKAGES_DIR = dir;
  process.env.MAX_EXPORT_ROWS = '15000';
  return dir;
});

// Transactions run their callback against a client whose queries land in the same mock, so every statement is visible
const db = vi.hoisted(() => {
  const query = vi.fn();
  const transaction = vi.fn(async (callback: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<unknown>) =>
    callback({ query: async (sql, params) => ({ rows: await query(sql, params) }) })
  );
  return { query, transaction };
});
vi.mock('$lib/services/postgres', () => ({ postgresPool: db }));

const ipfs = vi.hoisted(() => ({
  isEnabled: vi.fn(),
  isConnected: vi.fn(),
  publishDirectory: vi.fn(),
  fetchDirectory: vi.fn(),
  getGatewayUrl: vi.fn((cid: string) => `https://ipfs.io/ipfs/${cid}`)
}));
vi.mock('$lib/services/ipfsService', () => ({ ipfsService: ipfs }));

vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { GET, POST } from './+server';

const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const IMPORT_TABLE = 'ipfs_dm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const admin = { id: '1', email: 'root@example.com', name: 'Root', role: 'admin' as const };
const viewer = { ...admin, role: 'viewer' as const };

const get = (query: string, user: typeof admin | typeof viewer = admin) =>
  GET({ url: new URL(`http://localhost/api/data-sharing${query}`), locals: { user } } as unknown as Parameters<typeof GET>[0]);

const post = (body: unknown, user = admin) =>
  POST({
    request: new Request('http://localhost/api/data-sharing', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json' }
    }),
    locals: { user }
  } as unknown as Parameters<typeof POST>[0]);

/** Writes a generated package (what the generate flow produces) into the scratch packages directory. */
function writePackage(id: string, sourceTable: string, extra: Record<string, unknown> = {}) {
  const dir = join(PACKAGES_DIR, id);
  mkdirSync(dir, { recursive: true });
  const pkg = {
    name: id,
    title: `Package ${id}`,
    description: 'test',
    version: '1.0.0',
    created: '2026-01-01T00:00:00.000Z',
    resources: [
      { name: sourceTable, path: `${sourceTable}.csv`, format: 'csv', schema: { fields: [{ name: 'id', type: 'integer' }] } },
      { name: `${sourceTable}-preview`, path: `${sourceTable}-preview.csv`, format: 'csv', schema: { fields: [] } }
    ],
    social_explorer: { dataset_id: 7, source_schema: 'public', source_table: sourceTable, total_rows: 2, preview_rows: 2 },
    ...extra
  };
  writeFileSync(join(dir, 'datapackage.json'), JSON.stringify(pkg));
  writeFileSync(join(dir, `${sourceTable}-preview.csv`), 'id,text\n1,"hello, world"\n2,plain\n');
  return dir;
}

const readDescriptor = (id: string) => JSON.parse(readFileSync(join(PACKAGES_DIR, id, 'datapackage.json'), 'utf-8'));
const sqlCalls = () => db.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
const callsTo = (fragment: string) => db.query.mock.calls.filter(([sql]) => String(sql).includes(fragment));

const columns = [
  { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
  { column_name: 'text', data_type: 'text', is_nullable: 'YES' }
];

/** A database holding one catalogued dataset over a two-row table. */
function scriptDatabase(dataset: Record<string, unknown>, rows: Record<string, unknown>[] = [{ id: 1, text: 'hello, world' }, { id: 2, text: 'plain' }]) {
  db.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM datasets')) return [dataset];
    if (sql.includes('information_schema.columns')) return columns;
    if (sql.includes('COUNT(*)')) return [{ count: String(rows.length) }];
    if (sql.includes('SELECT * FROM')) return rows;
    return [];
  });
}

const posts = { name: 'Telegram posts', description: 'd', table_name: 'posts', schema_name: 'public' };

beforeEach(() => {
  mkdirSync(PACKAGES_DIR, { recursive: true });
  db.query.mockReset();
  db.query.mockResolvedValue([]);
  db.transaction.mockClear();
  ipfs.isEnabled.mockReset().mockReturnValue(true);
  ipfs.isConnected.mockReset().mockReturnValue(false);
  ipfs.publishDirectory.mockReset().mockResolvedValue(CID);
  ipfs.fetchDirectory.mockReset();
});

afterEach(() => {
  rmSync(PACKAGES_DIR, { recursive: true, force: true });
});

describe('GET /api/data-sharing?action=status', () => {
  it('says whether peer-to-peer sharing is turned on', async () => {
    ipfs.isEnabled.mockReturnValue(false);
    const body = await (await get('?action=status')).json();
    expect(body).toEqual({ success: true, data: { enabled: false, connected: false } });
  });

  it('reports whether the node is running, without starting it', async () => {
    ipfs.isConnected.mockReturnValue(true);
    expect((await (await get('?action=status', viewer)).json()).data).toEqual({ enabled: true, connected: true });

    ipfs.isConnected.mockReturnValue(false);
    expect((await (await get('?action=status')).json()).data).toEqual({ enabled: true, connected: false });
    expect(ipfs.publishDirectory).not.toHaveBeenCalled();
  });
});

describe('GET /api/data-sharing?action=list', () => {
  it('lists generated packages from the packages directory', async () => {
    writePackage('posts', 'posts');
    const body = await (await get('?action=list')).json();

    expect(body.success).toBe(true);
    expect(body.packages).toEqual([expect.objectContaining({ id: 'posts', title: 'Package posts', totalRows: 2, publishable: true })]);
  });

  it('marks an imported package (no local dataset) as not publishable', async () => {
    writePackage(IMPORT_TABLE, 'posts', { social_explorer: undefined });
    const body = await (await get('?action=list')).json();
    expect(body.packages).toEqual([expect.objectContaining({ id: IMPORT_TABLE, publishable: false })]);
  });

  it('answers an empty list when the directory does not exist yet', async () => {
    rmSync(PACKAGES_DIR, { recursive: true, force: true });
    const body = await (await get('?action=list')).json();
    expect(body).toEqual({ success: true, packages: [] });
  });
});

describe('GET /api/data-sharing?action=get', () => {
  it('returns the datapackage and a parsed preview (quoted commas intact)', async () => {
    writePackage('posts', 'posts');
    const body = await (await get('?action=get&id=posts')).json();

    expect(body.success).toBe(true);
    expect(body.datapackage.name).toBe('posts');
    expect(body.preview).toEqual([
      { id: '1', text: 'hello, world' },
      { id: '2', text: 'plain' }
    ]);
  });

  it.each(['../secret', '..', 'a/b', '/etc', 'x%00y'])('refuses an id that is not a plain identifier (%s) with 400', async (id) => {
    const response = await get(`?action=get&id=${encodeURIComponent(id)}`);
    expect(response.status).toBe(400);
  });

  it('returns 404 for an unknown package', async () => {
    expect((await get('?action=get&id=nope')).status).toBe(404);
  });

  it('does not read a preview file outside the package directory', async () => {
    const outside = join(PACKAGES_DIR, 'outside.csv');
    writeFileSync(outside, 'secret,data\n1,2\n');
    writePackage('posts', 'posts', {
      resources: [{ name: 'posts-preview', path: '../outside.csv', format: 'csv', schema: { fields: [] } }]
    });

    const body = await (await get('?action=get&id=posts')).json();

    expect(body.success).toBe(true);
    expect(body.preview).toEqual([]);
  });
});

describe('GET /api/data-sharing?action=registry', () => {
  it('lists published packages and reports whether sharing is enabled', async () => {
    db.query.mockImplementation(async (sql: string) => (sql.includes('SELECT') ? [{ cid: CID, package_id: 'posts' }] : []));
    const body = await (await get('?action=registry')).json();

    expect(body).toEqual({ success: true, enabled: true, packages: [{ cid: CID, package_id: 'posts' }] });
  });

  it('shows who published to admins only', async () => {
    await get('?action=registry', admin);
    await get('?action=registry', viewer);
    const [forAdmin, forViewer] = callsTo('ORDER BY published_at').map(([sql]) => String(sql));

    expect(forAdmin).toContain('published_by');
    expect(forViewer).not.toContain('published_by');
    expect(forViewer).not.toContain('SELECT *');
  });

  it('answers a generic 500 when the database fails, without the detail', async () => {
    db.query.mockRejectedValue(new Error('connection terminated unexpectedly'));
    const response = await get('?action=registry');
    const text = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(text).not.toContain('connection terminated');
  });
});

describe('GET /api/data-sharing?action=resolve', () => {
  it('rejects a malformed cid with 400', async () => {
    expect((await get('?action=resolve&cid=../../x')).status).toBe(400);
    expect((await get('?action=resolve')).status).toBe(400);
  });

  it('returns the gateway URL for a cid that is not in the registry', async () => {
    const body = await (await get(`?action=resolve&cid=${CID}`)).json();
    expect(body).toEqual({ success: true, found: false, gateway_url: `https://ipfs.io/ipfs/${CID}` });
  });
});

describe('POST /api/data-sharing (generate)', () => {
  it('rejects a malformed body with 400', async () => {
    expect((await post('{not json')).status).toBe(400);
  });

  it('requires a catalogued dataset: a table name in the body is not enough', async () => {
    const response = await post({ table_name: 'app_users', schema_name: 'public' });

    expect(response.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each(['9abc', -1, 0, '1; DROP TABLE x', 1.5])('refuses dataset_id %j with 400', async (datasetId) => {
    expect((await post({ dataset_id: datasetId })).status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns 404 for a dataset that is not in the catalogue', async () => {
    expect((await post({ dataset_id: 7 })).status).toBe(404);
  });

  it.each(['app_users', 'user_dataset_access'])('refuses to package the application table or view %s even when the catalogue points at it', async (table) => {
    db.query.mockResolvedValue([{ ...posts, table_name: table }]);
    const response = await post({ dataset_id: 7 });

    expect(response.status).toBe(403);
    expect(sqlCalls().some((sql) => sql.includes(table))).toBe(false);
  });

  it('refuses a catalogue row whose table or schema is not a plain identifier', async () => {
    db.query.mockResolvedValue([{ ...posts, table_name: 'posts; DROP TABLE app_users; --' }]);
    const response = await post({ dataset_id: 7 });

    expect(response.status).toBe(422);
    expect(sqlCalls().some((sql) => sql.includes('DROP'))).toBe(false);
  });

  it('writes the datapackage and preview, quoting identifiers and capping preview rows', async () => {
    scriptDatabase(posts);
    const response = await post({ dataset_id: 7, preview_rows: 5_000_000 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.package_id).toBe('telegram-posts');
    expect(body).not.toHaveProperty('output_dir');
    expect(sqlCalls()).toEqual(expect.arrayContaining([expect.stringContaining('FROM "public"."posts"')]));
    expect(callsTo('LIMIT $1')[0]?.[1]).toEqual([1000]);

    expect(readDescriptor('telegram-posts').social_explorer).toEqual({ dataset_id: 7, source_schema: 'public', source_table: 'posts', total_rows: 2, preview_rows: 2 });
    expect(readFileSync(join(PACKAGES_DIR, 'telegram-posts', 'posts-preview.csv'), 'utf-8')).toBe('id,text\n1,"hello, world"\n2,plain');
  });

  it('writes timestamps as ISO 8601 and escapes awkward column names in the header', async () => {
    db.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM datasets')) return [posts];
      if (sql.includes('information_schema.columns')) return [{ column_name: 'when', data_type: 'timestamp without time zone', is_nullable: 'YES' }, { column_name: 'a,b', data_type: 'text', is_nullable: 'YES' }];
      if (sql.includes('COUNT(*)')) return [{ count: '1' }];
      return [{ when: new Date('2024-05-01T12:00:00Z'), 'a,b': 'x' }];
    });
    await post({ dataset_id: 7 });

    expect(readFileSync(join(PACKAGES_DIR, 'telegram-posts', 'posts-preview.csv'), 'utf-8')).toBe('when,"a,b"\n2024-05-01T12:00:00.000Z,x');
  });

  it('gives a dataset whose name has nothing usable a package id from its id', async () => {
    scriptDatabase({ ...posts, name: '(???)' });
    const body = await (await post({ dataset_id: 7 })).json();
    expect(body.package_id).toBe('dataset-7');
  });

  it('returns 404 when the dataset table has no columns (it does not exist)', async () => {
    db.query.mockImplementation(async (sql: string) => (sql.includes('FROM datasets') ? [posts] : []));
    expect((await post({ dataset_id: 7 })).status).toBe(404);
  });

  it('answers a generic 500 when the database fails', async () => {
    db.query.mockRejectedValue(new Error('connection terminated unexpectedly'));
    const response = await post({ dataset_id: 7 });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('connection terminated');
  });
});

describe('POST /api/data-sharing action=publish', () => {
  it('answers 503 with a plain explanation when sharing is turned off', async () => {
    ipfs.isEnabled.mockReturnValue(false);
    writePackage('posts', 'posts');
    const response = await post({ action: 'publish', package_id: 'posts' });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/IPFS_ENABLED/);
    expect(ipfs.publishDirectory).not.toHaveBeenCalled();
  });

  it.each(['../../etc', '..', 'a/b', '', undefined])('refuses package_id %j with 400 before touching IPFS', async (packageId) => {
    const response = await post({ action: 'publish', package_id: packageId });

    expect(response.status).toBe(400);
    expect(ipfs.publishDirectory).not.toHaveBeenCalled();
  });

  it('returns 404 for a package that was never generated', async () => {
    expect((await post({ action: 'publish', package_id: 'missing' })).status).toBe(404);
  });

  it('refuses to export an application table even when the catalogue points at it', async () => {
    writePackage('users', 'app_users');
    scriptDatabase({ ...posts, table_name: 'app_users' });
    const response = await post({ action: 'publish', package_id: 'users' });

    expect(response.status).toBe(403);
    expect(ipfs.publishDirectory).not.toHaveBeenCalled();
    expect(sqlCalls().some((sql) => sql.includes('app_users'))).toBe(false);
  });

  it('takes the table from the catalogue, never from the descriptor on disk', async () => {
    writePackage('posts', 'user_dataset_access');
    scriptDatabase(posts);
    const response = await post({ action: 'publish', package_id: 'posts' });

    expect(response.status).toBe(422);
    expect(ipfs.publishDirectory).not.toHaveBeenCalled();
    expect(sqlCalls().some((sql) => sql.includes('user_dataset_access'))).toBe(false);
  });

  it('refuses an imported package, which was generated elsewhere and names no local dataset', async () => {
    writePackage(IMPORT_TABLE, 'posts', { social_explorer: undefined });
    scriptDatabase(posts);
    const response = await post({ action: 'publish', package_id: IMPORT_TABLE });

    expect(response.status).toBe(422);
    expect(ipfs.publishDirectory).not.toHaveBeenCalled();
    expect(callsTo('SELECT * FROM')).toHaveLength(0);
  });

  it('exports the table with quoted identifiers, publishes the directory and records who published', async () => {
    writePackage('posts', 'posts');
    scriptDatabase(posts, [{ id: 1, text: 'a,b' }, { id: 2, text: 'c' }]);

    const response = await post({ action: 'publish', package_id: 'posts' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, cid: CID, gateway_url: `https://ipfs.io/ipfs/${CID}`, package_id: 'posts' });
    expect(ipfs.publishDirectory).toHaveBeenCalledWith(join(PACKAGES_DIR, 'posts'));
    expect(readFileSync(join(PACKAGES_DIR, 'posts', 'posts.csv'), 'utf-8')).toBe('id,text\n1,"a,b"\n2,c');
    expect(sqlCalls()).toEqual(expect.arrayContaining([expect.stringContaining('FROM "public"."posts"')]));
    const [insert] = callsTo('INSERT INTO ipfs_published_packages');
    expect(insert?.[1]).toContain('root@example.com');
    expect(insert?.[1]).toContain(2);
    expect(String(insert?.[0])).not.toContain('current_user');
  });

  describe('export order', () => {
    const exportSelects = () => callsTo('SELECT * FROM').map(([sql]) => String(sql));

    it('orders every batch by all columns when the table has no primary key, so LIMIT/OFFSET pages never overlap', async () => {
      writePackage('posts', 'posts');
      scriptDatabase(posts);

      await post({ action: 'publish', package_id: 'posts' });

      expect(exportSelects()).toEqual(['SELECT * FROM "public"."posts" ORDER BY 1, 2 LIMIT $1 OFFSET $2']);
    });

    it('orders by the primary key when the table has one, looked up without putting names in SQL', async () => {
      writePackage('posts', 'posts');
      db.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM datasets')) return [posts];
        if (sql.includes('information_schema.columns')) return columns;
        if (sql.includes('indisprimary')) return [{ column_name: 'text' }, { column_name: 'id' }];
        if (sql.includes('COUNT(*)')) return [{ count: '2' }];
        if (sql.includes('SELECT * FROM')) return [{ id: 1, text: 'a' }];
        return [];
      });

      await post({ action: 'publish', package_id: 'posts' });

      expect(exportSelects()).toEqual(['SELECT * FROM "public"."posts" ORDER BY 2, 1 LIMIT $1 OFFSET $2']);
      expect(callsTo('indisprimary')[0]?.[1]).toEqual(['"public"."posts"']);
    });

    it('leaves out columns Postgres may not be able to sort (json, arrays, user-defined types) and still publishes a table made only of them', async () => {
      writePackage('posts', 'posts');
      db.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM datasets')) return [posts];
        if (sql.includes('information_schema.columns')) {
          return [
            { column_name: 'raw', data_type: 'json', is_nullable: 'YES' },
            { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
            { column_name: 'tags', data_type: 'ARRAY', is_nullable: 'YES' },
            { column_name: 'extra', data_type: 'USER-DEFINED', is_nullable: 'YES' }
          ];
        }
        if (sql.includes('COUNT(*)')) return [{ count: '1' }];
        if (sql.includes('SELECT * FROM')) return [{ raw: '{}', id: 1 }];
        return [];
      });
      await post({ action: 'publish', package_id: 'posts' });
      expect(exportSelects()).toEqual(['SELECT * FROM "public"."posts" ORDER BY 2 LIMIT $1 OFFSET $2']);

      db.query.mockClear();
      db.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM datasets')) return [posts];
        if (sql.includes('information_schema.columns')) return [{ column_name: 'raw', data_type: 'json', is_nullable: 'YES' }];
        if (sql.includes('COUNT(*)')) return [{ count: '1' }];
        if (sql.includes('SELECT * FROM')) return [{ raw: '{}' }];
        return [];
      });
      const response = await post({ action: 'publish', package_id: 'posts' });
      expect(response.status).toBe(200);
      expect(exportSelects()).toEqual(['SELECT * FROM "public"."posts" LIMIT $1 OFFSET $2']);
    });
  });

  it('brings the descriptor up to date with the exported columns and row count', async () => {
    writePackage('posts', 'posts');
    scriptDatabase(posts);
    await post({ action: 'publish', package_id: 'posts' });

    const descriptor = readDescriptor('posts');
    expect(descriptor.resources[0].schema.fields.map((field: { name: string }) => field.name)).toEqual(['id', 'text']);
    expect(descriptor.resources[0].row_count).toBe(2);
    expect(descriptor.social_explorer.truncated).toBeUndefined();
  });

  it('stops at MAX_EXPORT_ROWS without overshooting, and says so in the descriptor and the registry', async () => {
    writePackage('posts', 'posts');
    db.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM datasets')) return [posts];
      if (sql.includes('information_schema.columns')) return columns;
      if (sql.includes('COUNT(*)')) return [{ count: '20000' }];
      if (sql.includes('SELECT * FROM')) return Array.from({ length: Number(params?.[0]) }, (_, i) => ({ id: i, text: 't' }));
      return [];
    });
    await post({ action: 'publish', package_id: 'posts' });

    expect(callsTo('OFFSET').map(([, params]) => params)).toEqual([
      [10000, 0],
      [5000, 10000]
    ]);
    expect(readFileSync(join(PACKAGES_DIR, 'posts', 'posts.csv'), 'utf-8').split('\n')).toHaveLength(15001);
    const descriptor = readDescriptor('posts');
    expect(descriptor.social_explorer).toMatchObject({ total_rows: 20000, truncated: true });
    expect(descriptor.resources[0].row_count).toBe(15000);
    expect(callsTo('INSERT INTO ipfs_published_packages')[0]?.[1]).toContain(15000);
  });

  it('answers a generic 500 when publishing fails, without the detail', async () => {
    writePackage('posts', 'posts');
    scriptDatabase(posts);
    ipfs.publishDirectory.mockRejectedValue(new Error('ECONNREFUSED /ip4/10.0.0.1/tcp/4001'));

    const response = await post({ action: 'publish', package_id: 'posts' });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('ECONNREFUSED');
  });

  it('answers 503 with the setting to fix when the network configuration is invalid', async () => {
    writePackage('posts', 'posts');
    scriptDatabase(posts);
    ipfs.publishDirectory.mockRejectedValue(new NetworkConfigError('IPFS_LISTEN_ADDRS holds a value that is not a multiaddr: "x"'));

    const response = await post({ action: 'publish', package_id: 'posts' });

    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('IPFS_LISTEN_ADDRS');
  });
});

describe('POST /api/data-sharing action=import', () => {
  const fields = [
    { name: 'id', type: 'integer' },
    { name: 'text', type: 'string' }
  ];

  /** Makes the mocked fetch write a package into whatever directory the route asks for. */
  function fetchedPackage(pkg: unknown, csv = 'id,text\n1,"hello, world"\n2,plain\n') {
    ipfs.fetchDirectory.mockImplementation(async (_cid: string, outDir: string) => {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'datapackage.json'), JSON.stringify(pkg));
      writeFileSync(join(outDir, 'posts.csv'), csv);
      return ['datapackage.json', 'posts.csv'];
    });
  }

  const validPackage = {
    title: 'Shared posts',
    description: 'd',
    resources: [{ name: 'posts', path: 'posts.csv', format: 'csv', schema: { fields } }],
    social_explorer: { dataset_id: 1, source_schema: 'public', source_table: 'app_users' }
  };

  it('answers 503 when sharing is turned off', async () => {
    ipfs.isEnabled.mockReturnValue(false);
    const response = await post({ action: 'import', cid: CID });

    expect(response.status).toBe(503);
    expect(ipfs.fetchDirectory).not.toHaveBeenCalled();
  });

  it.each(['', 'not-a-cid', '../../etc/passwd', undefined])('refuses cid %j with 400 before fetching', async (cid) => {
    const response = await post({ action: 'import', cid });

    expect(response.status).toBe(400);
    expect(ipfs.fetchDirectory).not.toHaveBeenCalled();
  });

  it('imports a package in one transaction: a new table with quoted columns, the parsed rows and a catalogue entry', async () => {
    fetchedPackage(validPackage);
    const response = await post({ action: 'import', cid: CID });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, table_name: IMPORT_TABLE, row_count: 2, fields: 2, cid: CID, package_title: 'Shared posts' });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(sqlCalls().find((sql) => sql.startsWith('CREATE TABLE'))).toBe(`CREATE TABLE "${IMPORT_TABLE}" ("id" BIGINT, "text" TEXT)`);
    expect(callsTo(`INSERT INTO "${IMPORT_TABLE}"`)[0]?.[1]).toEqual(['1', 'hello, world', '2', 'plain']);
    const [catalogue] = callsTo('INSERT INTO datasets');
    expect(String(catalogue?.[0])).toContain('source_database');
    expect(String(catalogue?.[0])).toContain("'available'");
    expect(catalogue?.[1]).toEqual(['Shared posts (y55fbzdi)', 'd', IMPORT_TABLE, 2, 'root@example.com']);
  });

  it("saves the package locally without the remote's social_explorer block, so it can never name a local table", async () => {
    fetchedPackage(validPackage);
    await post({ action: 'import', cid: CID });

    const saved = readDescriptor(IMPORT_TABLE);
    expect(saved.title).toBe('Shared posts');
    expect(saved).not.toHaveProperty('social_explorer');
    expect(existsSync(join(PACKAGES_DIR, IMPORT_TABLE, 'posts.csv'))).toBe(true);
  });

  it('refuses a CID that was already imported with 409, before fetching', async () => {
    db.query.mockImplementation(async (sql: string) => (sql.includes('WHERE cid = $1') ? [{ status: 'imported', package_id: IMPORT_TABLE }] : []));
    const response = await post({ action: 'import', cid: CID });

    expect(response.status).toBe(409);
    expect(ipfs.fetchDirectory).not.toHaveBeenCalled();
  });

  it('keeps batches within the parameter limit for wide tables', async () => {
    const wide = Array.from({ length: 70 }, (_, i) => ({ name: `c${i}`, type: 'string' }));
    const header = wide.map((field) => field.name).join(',');
    const rows = Array.from({ length: 1000 }, () => wide.map(() => 'v').join(','));
    fetchedPackage({ ...validPackage, resources: [{ ...validPackage.resources[0], schema: { fields: wide } }] }, [header, ...rows].join('\n'));

    const response = await post({ action: 'import', cid: CID });

    expect(response.status).toBe(200);
    const inserts = callsTo(`INSERT INTO "${IMPORT_TABLE}"`);
    expect(inserts.length).toBeGreaterThan(1);
    for (const [, params] of inserts) expect((params as unknown[]).length).toBeLessThanOrEqual(65535);
    expect(inserts.reduce((sum, [, params]) => sum + (params as unknown[]).length, 0)).toBe(70_000);
  });

  it('rejects a package whose field names are not plain identifiers, without creating anything', async () => {
    fetchedPackage({ ...validPackage, resources: [{ ...validPackage.resources[0], schema: { fields: [{ name: 'id"; DROP TABLE app_users; --', type: 'string' }] } }] });
    const response = await post({ action: 'import', cid: CID });

    expect(response.status).toBe(422);
    expect(sqlCalls().some((sql) => sql.includes('CREATE TABLE') || sql.includes('DROP'))).toBe(false);
  });

  it('rejects a package whose resource path is not one of the fetched files', async () => {
    fetchedPackage({ ...validPackage, resources: [{ ...validPackage.resources[0], path: '../../etc/passwd' }] });
    const response = await post({ action: 'import', cid: CID });

    expect(response.status).toBe(422);
    expect(sqlCalls().some((sql) => sql.includes('CREATE TABLE'))).toBe(false);
  });

  it('rejects a CSV whose header does not match the declared fields', async () => {
    fetchedPackage(validPackage, 'id,other\n1,2\n');
    const response = await post({ action: 'import', cid: CID });

    expect(response.status).toBe(422);
    expect(sqlCalls().some((sql) => sql.includes('CREATE TABLE'))).toBe(false);
  });

  it('rejects a package without datapackage.json', async () => {
    ipfs.fetchDirectory.mockImplementation(async (_cid: string, outDir: string) => {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'posts.csv'), 'id\n1\n');
      return ['posts.csv'];
    });
    expect((await post({ action: 'import', cid: CID })).status).toBe(422);
  });

  it.each([
    ['22P02', 422],
    ['22007', 422],
    ['42P07', 409]
  ])('maps a Postgres error %s caused by the package contents to %i', async (code, status) => {
    fetchedPackage(validPackage);
    db.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('CREATE TABLE') || sql.startsWith(`INSERT INTO "${IMPORT_TABLE}"`)) throw Object.assign(new Error('invalid input syntax'), { code });
      return [];
    });
    const response = await post({ action: 'import', cid: CID });

    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain('invalid input syntax');
  });

  it.each([
    [new UnsafePackageError('a file name in the package is not allowed'), 422],
    [new PackageTooLargeError(1024), 422],
    [Object.assign(new Error('aborted'), { name: 'TimeoutError' }), 504],
    [new IpfsDisabledError(), 503]
  ])('maps a fetch failure (%s) to %i', async (error, status) => {
    ipfs.fetchDirectory.mockRejectedValue(error);
    const response = await post({ action: 'import', cid: CID });
    expect(response.status).toBe(status);
    expect(sqlCalls().some((sql) => sql.includes('CREATE TABLE'))).toBe(false);
  });

  it('answers a generic 500 for an unexpected failure and leaves no temp directory behind', async () => {
    fetchedPackage(validPackage);
    db.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('CREATE TABLE')) throw new Error('permission denied for schema public');
      return [];
    });
    const response = await post({ action: 'import', cid: CID });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('permission denied');
    const [, outDir] = ipfs.fetchDirectory.mock.calls[0];
    expect(existsSync(outDir)).toBe(false);
    expect(existsSync(join(PACKAGES_DIR, IMPORT_TABLE))).toBe(false);
  });
});
