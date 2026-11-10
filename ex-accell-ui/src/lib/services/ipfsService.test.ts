import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isValidCid } from './ipfsCid';

vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

// The service reads its environment when it loads, so each case loads a fresh copy. Module identity changes with it,
// so failures are matched by name rather than instanceof.
const disabled = { name: 'IpfsDisabledError' };

async function loadService(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import('./ipfsService');
}

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('isValidCid', () => {
  it.each([
    'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy',
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
  ])('accepts %s', (cid) => {
    expect(isValidCid(cid)).toBe(true);
  });

  it.each(['', 'not a cid', '../../etc/passwd', 'bafy', 'Qm123', 'http://evil.example/x', null, undefined, 12, 'b'.repeat(300)])(
    'rejects %j',
    (cid) => {
      expect(isValidCid(cid)).toBe(false);
    }
  );
});

describe('ipfsService when IPFS_ENABLED is unset', () => {
  let service: Awaited<ReturnType<typeof loadService>>['ipfsService'];
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'ipfs-test-'));
    ({ ipfsService: service } = await loadService({ IPFS_ENABLED: undefined }));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('is off by default (opt-in)', () => {
    expect(service.isEnabled()).toBe(false);
    expect(service.isConnected()).toBe(false);
  });

  it('refuses to connect, publish, fetch or cat with IpfsDisabledError', async () => {
    await expect(service.connect()).rejects.toMatchObject(disabled);
    await expect(service.publishDirectory(dir)).rejects.toMatchObject(disabled);
    await expect(service.fetchDirectory('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', dir)).rejects.toMatchObject(disabled);
    await expect(service.cat('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).rejects.toMatchObject(disabled);
  });

  it('reports unhealthy without trying to start a node', async () => {
    expect(await service.healthCheck()).toBe(false);
  });

  it.each(['false', 'FALSE', '1', 'yes', ''])('stays off for IPFS_ENABLED=%j: only the exact string "true" turns it on', async (value) => {
    const { ipfsService } = await loadService({ IPFS_ENABLED: value });
    expect(ipfsService.isEnabled()).toBe(false);
  });

  it('turns on for IPFS_ENABLED=true', async () => {
    const { ipfsService } = await loadService({ IPFS_ENABLED: 'true' });
    expect(ipfsService.isEnabled()).toBe(true);
  });
});

describe('ipfsService input checks when enabled', () => {
  it('rejects a malformed CID before touching the network', async () => {
    const { ipfsService } = await loadService({ IPFS_ENABLED: 'true' });
    const connect = vi.spyOn(ipfsService, 'connect');

    await expect(ipfsService.fetchDirectory('../../etc', tmpdir())).rejects.toThrow(/CID/);
    await expect(ipfsService.cat('nope')).rejects.toThrow(/CID/);
    expect(connect).not.toHaveBeenCalled();
  });

  it('builds the gateway URL from the configured gateway, stripping a trailing slash', async () => {
    const { ipfsService } = await loadService({ IPFS_ENABLED: 'true', IPFS_GATEWAY_URL: 'https://gateway.example/ipfs/' });
    expect(ipfsService.getGatewayUrl('bafyabc')).toBe('https://gateway.example/ipfs/bafyabc');
  });

  it('uses the public ipfs.io gateway by default', async () => {
    const { ipfsService } = await loadService({ IPFS_ENABLED: 'true', IPFS_GATEWAY_URL: undefined });
    expect(ipfsService.getGatewayUrl('bafyabc')).toBe('https://ipfs.io/ipfs/bafyabc');
  });
});
