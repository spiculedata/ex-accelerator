// @vitest-environment node
// The service against a fake Helia node: what it publishes, what it refuses to fetch, and the caps it applies.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

type Entry = { type: string; name: string; cid: string };

/** An in-memory stand-in for Helia + unixfs: files by CID, directories as entry lists. */
const fake = vi.hoisted(() => {
  const files = new Map<string, Uint8Array>();
  const directories = new Map<string, Entry[]>();
  let nextCid = 0;
  const state = {
    files,
    directories,
    pins: [] as string[],
    starts: 0,
    stopped: 0,
    stopError: null as Error | null,
    startError: null as Error | null,
    closedStores: 0,
    heliaOptions: [] as Record<string, unknown>[],
    reset() {
      files.clear();
      directories.clear();
      state.pins = [];
      state.starts = 0;
      state.stopped = 0;
      state.stopError = null;
      state.startError = null;
      state.closedStores = 0;
      state.heliaOptions = [];
      nextCid = 0;
    },
    ufs: {
      async addBytes(bytes: Uint8Array) {
        const cid = `bafyfile${nextCid++}`;
        files.set(cid, bytes);
        return cid;
      },
      async addDirectory() {
        const cid = `bafydir${nextCid++}`;
        directories.set(cid, []);
        return cid;
      },
      async cp(source: string, target: string, name: string) {
        directories.set(target, [...(directories.get(target) ?? []), { type: 'file', name, cid: source }]);
        return target;
      },
      async *ls(cid: string) {
        for (const entry of directories.get(cid) ?? []) yield entry;
      },
      async *cat(cid: string) {
        const bytes = files.get(cid);
        if (!bytes) throw new Error(`no such file ${cid}`);
        // Two chunks, so the byte cap is tested across chunk boundaries
        const half = Math.ceil(bytes.length / 2);
        yield bytes.subarray(0, half);
        if (half < bytes.length) yield bytes.subarray(half);
      }
    }
  };
  return state;
});

vi.mock('helia', () => ({
  libp2pDefaults: () => ({
    addresses: { listen: ['/ip4/0.0.0.0/tcp/0', '/p2p-circuit'] },
    services: { upnp: 'u', relay: 'r', autoTLS: 'a', dht: 'd' }
  }),
  createHelia: async (options: Record<string, unknown>) => {
    fake.heliaOptions.push(options);
    fake.starts++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (fake.startError) throw fake.startError;
    return {
      libp2p: { peerId: { toString: () => '12D3KooWfake' } },
      pins: { add: async (cid: string) => void fake.pins.push(cid) },
      stop: async () => {
        fake.stopped++;
        if (fake.stopError) throw fake.stopError;
      }
    };
  }
}));
vi.mock('@helia/unixfs', () => ({ unixfs: () => fake.ufs }));
class FakeStore {
  async close() {
    fake.closedStores++;
  }
}
vi.mock('blockstore-fs', () => ({ FsBlockstore: FakeStore }));
vi.mock('datastore-level', () => ({ LevelDatastore: FakeStore }));
// A real multiformats CID is not needed: the service only passes the parsed value back to unixfs
vi.mock('multiformats/cid', () => ({ CID: { parse: (value: string) => value } }));

const DIR_CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const KB = 1024;

let dir: string;
let service: typeof import('./ipfsService').ipfsService;
const savedEnv = { ...process.env };

async function loadService(env: Record<string, string> = {}) {
  await service?.close().catch(() => undefined); // a replaced service would otherwise keep its shutdown listener
  vi.resetModules();
  process.env = { ...savedEnv, IPFS_ENABLED: 'true', IPFS_BLOCKSTORE_PATH: join(dir, 'blocks'), IPFS_DATASTORE_PATH: join(dir, 'datastore'), ...env };
  ({ ipfsService: service } = await import('./ipfsService'));
}

/** Registers a directory in the fake node and returns a CID the service can fetch. */
function publishedDirectory(entries: { name: string; content: string; type?: string }[]): string {
  fake.directories.set(
    DIR_CID,
    entries.map((entry, i) => {
      const cid = `bafyremote${i}`;
      fake.files.set(cid, new TextEncoder().encode(entry.content));
      return { type: entry.type ?? 'file', name: entry.name, cid };
    })
  );
  return DIR_CID;
}

beforeEach(async () => {
  fake.reset();
  dir = mkdtempSync(join(tmpdir(), 'ipfs-node-test-'));
  await loadService();
});

afterEach(async () => {
  // Each test's service registers a process listener once its node starts; close it so none leaks into the next test
  await service.close().catch(() => undefined);
  process.env = { ...savedEnv };
  rmSync(dir, { recursive: true, force: true });
});

describe('publishDirectory', () => {
  it('adds the plain files of the directory, pins the directory and returns its CID', async () => {
    const pkg = join(dir, 'pkg');
    mkdirSync(join(pkg, 'nested'), { recursive: true });
    writeFileSync(join(pkg, 'datapackage.json'), '{}');
    writeFileSync(join(pkg, 'posts.csv'), 'id\n1');
    writeFileSync(join(pkg, '.hidden'), 'secret');

    const cid = await service.publishDirectory(pkg);

    expect(fake.pins).toEqual([cid]);
    expect(fake.directories.get(cid)?.map((entry) => entry.name).sort()).toEqual(['datapackage.json', 'posts.csv']);
    expect(service.isConnected()).toBe(true);
  });

  it('refuses an empty directory without pinning anything', async () => {
    await expect(service.publishDirectory(dir)).rejects.toThrow(/No files/);
    expect(fake.pins).toEqual([]);
  });

  it('starts one node even when two publishes race on a cold start', async () => {
    const pkg = join(dir, 'pkg');
    mkdirSync(pkg);
    writeFileSync(join(pkg, 'datapackage.json'), '{}');

    await Promise.all([service.publishDirectory(pkg), service.publishDirectory(pkg)]);

    expect(fake.starts).toBe(1);
  });
});

describe('fetchDirectory', () => {
  it('writes each file of the directory into the output directory and returns the names', async () => {
    const cid = publishedDirectory([
      { name: 'datapackage.json', content: '{"name":"x"}' },
      { name: 'posts.csv', content: 'id\n1\n' },
      { name: 'sub', content: '', type: 'directory' }
    ]);
    const out = join(dir, 'out');

    const names = await service.fetchDirectory(cid, out);

    expect(names).toEqual(['datapackage.json', 'posts.csv']);
    expect(readFileSync(join(out, 'posts.csv'), 'utf-8')).toBe('id\n1\n');
    expect(readdirSync(out).sort()).toEqual(['datapackage.json', 'posts.csv']);
  });

  it.each(['../escape.csv', 'a/b.csv', '.env', ''])('refuses a package holding the file name %j and writes nothing outside the output directory', async (name) => {
    // A safe file first: the refusal comes when the bad name is reached, and the caller discards the output directory
    const cid = publishedDirectory([
      { name: 'datapackage.json', content: '{}' },
      { name, content: 'x' }
    ]);
    const out = join(dir, 'out');

    await expect(service.fetchDirectory(cid, out)).rejects.toMatchObject({ name: 'UnsafePackageError' });
    expect(readdirSync(out)).toEqual(['datapackage.json']);
    expect(readdirSync(dir).sort()).toEqual(['blocks', 'datastore', 'out']);
  });

  it('stops at the byte cap, counted across every file', async () => {
    await loadService({ IPFS_MAX_FETCH_BYTES: String(3 * KB) });
    const cid = publishedDirectory([
      { name: 'a.csv', content: 'x'.repeat(2 * KB) },
      { name: 'b.csv', content: 'y'.repeat(2 * KB) }
    ]);

    await expect(service.fetchDirectory(cid, join(dir, 'out'))).rejects.toMatchObject({ name: 'PackageTooLargeError' });
  });

  it('refuses a directory with more files than a package can have', async () => {
    const cid = publishedDirectory(Array.from({ length: 101 }, (_, i) => ({ name: `f${i}.csv`, content: 'x' })));

    await expect(service.fetchDirectory(cid, join(dir, 'out'))).rejects.toThrow(/more than 100 files/);
  });

  it('rejects a malformed CID before starting the node', async () => {
    await expect(service.fetchDirectory('not-a-cid', join(dir, 'out'))).rejects.toMatchObject({ name: 'InvalidCidError' });
    expect(fake.starts).toBe(0);
  });
});

describe('cat and close', () => {
  it('returns a file by CID and applies the byte cap', async () => {
    fake.files.set('bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy', new TextEncoder().encode('hello'));

    expect((await service.cat('bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy')).toString()).toBe('hello');

    await loadService({ IPFS_MAX_FETCH_BYTES: '2' });
    fake.files.set('bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy', new TextEncoder().encode('hello'));
    await expect(service.cat('bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy')).rejects.toMatchObject({ name: 'PackageTooLargeError' });
  });

  it('stops the node on close and forgets it', async () => {
    await service.connect();
    expect(service.isConnected()).toBe(true);

    await service.close();

    expect(fake.stopped).toBe(1);
    expect(service.isConnected()).toBe(false);
    await service.close(); // a second close is a no-op
    expect(fake.stopped).toBe(1);
  });

  it('reports whether the node is up without starting one', async () => {
    expect(service.isConnected()).toBe(false);
    expect(fake.starts).toBe(0);

    await service.connect();

    expect(service.isConnected()).toBe(true);
  });
});

describe('shutdown', () => {
  const shutdownListeners = () => process.listenerCount('sveltekit:shutdown' as never);

  it('is safe when the node never started: nothing to stop and no listener left behind', async () => {
    const before = shutdownListeners();

    await expect(service.close()).resolves.toBeUndefined();

    expect(fake.stopped).toBe(0);
    expect(shutdownListeners()).toBe(before);
  });

  it('waits for a node that is still starting, then stops it', async () => {
    const connecting = service.connect();

    await service.close();
    await connecting;

    expect(fake.starts).toBe(1);
    expect(fake.stopped).toBe(1);
    expect(service.isConnected()).toBe(false);
  });

  it('stops the node once when close is called twice at the same time', async () => {
    await service.connect();

    await Promise.all([service.close(), service.close()]);

    expect(fake.stopped).toBe(1);
  });

  it("stops the node when adapter-node announces shutdown, and removes its listener", async () => {
    const before = shutdownListeners();
    await service.connect();
    expect(shutdownListeners()).toBe(before + 1);

    process.emit('sveltekit:shutdown' as never);
    await vi.waitFor(() => expect(fake.stopped).toBe(1));

    expect(service.isConnected()).toBe(false);
    expect(shutdownListeners()).toBe(before);
  });

  it('can start again after a close', async () => {
    await service.connect();
    await service.close();

    await service.connect();

    expect(fake.starts).toBe(2);
    expect(service.isConnected()).toBe(true);
  });

  it('closes the blockstore and datastore itself when the node fails to stop, and still forgets the node', async () => {
    await service.connect();
    fake.stopError = new Error('stop failed');

    await expect(service.close()).rejects.toThrow('stop failed');

    expect(fake.closedStores).toBe(2);
    expect(service.isConnected()).toBe(false);
  });

  it('stops a node that finishes starting after the shutdown event, instead of leaving it running', async () => {
    const connecting = service.connect();

    process.emit('sveltekit:shutdown' as never); // arrives while createHelia is still pending
    await connecting;
    await vi.waitFor(() => expect(fake.stopped).toBe(1));

    expect(service.isConnected()).toBe(false);
  });

  it('refuses to start a node once shutdown has begun', async () => {
    await service.connect();
    process.emit('sveltekit:shutdown' as never);
    await vi.waitFor(() => expect(fake.stopped).toBe(1));

    await expect(service.connect()).rejects.toThrow(/shutting down/);

    expect(fake.starts).toBe(1);
  });

  it('closes the stores it opened and leaves no listener when the node fails to start, so a retry can succeed', async () => {
    const before = shutdownListeners();
    fake.startError = new Error('lock held');

    await expect(service.connect()).rejects.toThrow('lock held');

    expect(fake.closedStores).toBe(2);
    expect(shutdownListeners()).toBe(before);

    fake.startError = null;
    await service.connect();
    expect(service.isConnected()).toBe(true);
  });
});

describe('network configuration', () => {
  it('builds the node with Helia defaults when no network variable is set', async () => {
    await service.connect();

    expect(fake.heliaOptions).toHaveLength(1);
    expect(fake.heliaOptions[0]).not.toHaveProperty('libp2p');
  });

  it('passes listen addresses and switched-off services to libp2p', async () => {
    await loadService({ IPFS_LISTEN_ADDRS: '/ip4/0.0.0.0/tcp/4001', IPFS_UPNP: 'false', IPFS_RELAY_SERVER: 'false' });

    await service.connect();

    expect(fake.heliaOptions[0]).toMatchObject({
      libp2p: { addresses: { listen: ['/ip4/0.0.0.0/tcp/4001'] }, services: { autoTLS: 'a', dht: 'd' } }
    });
    expect(fake.heliaOptions[0].libp2p).not.toHaveProperty('services.upnp');
  });

  it('refuses to start, without creating a node, when an address is malformed', async () => {
    await loadService({ IPFS_LISTEN_ADDRS: 'not-a-multiaddr' });

    await expect(service.connect()).rejects.toThrow(/IPFS_LISTEN_ADDRS/);

    expect(fake.starts).toBe(0);
    expect(service.isConnected()).toBe(false);
  });
});
