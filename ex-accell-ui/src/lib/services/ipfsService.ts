// IPFS peer-to-peer data sharing (Helia): content-addressed publishing and fetching of Frictionless Data Packages.
//
// Off unless IPFS_ENABLED is exactly "true". When on, the first publish or fetch starts a Helia node inside the app
// process with libp2p's defaults: it listens on random TCP, WebSocket and WebRTC-direct ports on every interface,
// dials the public bootstrap peers and joins the public DHT. Anything published is public and cannot be withdrawn.

import fs from 'fs';
import path from 'path';
import { createLogger } from '$lib/utils/logger';
import { isSafePackageFileName } from '$lib/server/dataSharing/identifiers';
import { resolveWithin } from '$lib/utils/pathSafety';
import { isValidCid } from './ipfsCid';
import { InvalidCidError, IpfsDisabledError, PackageTooLargeError, UnsafePackageError } from './ipfsErrors';

const log = createLogger('ipfs');

const IPFS_BLOCKSTORE_PATH = process.env.IPFS_BLOCKSTORE_PATH || '/data/ipfs/blocks';
const IPFS_DATASTORE_PATH = process.env.IPFS_DATASTORE_PATH || '/data/ipfs/datastore';
const IPFS_GATEWAY_URL = (process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs').replace(/\/+$/, '');
const IPFS_ENABLED = process.env.IPFS_ENABLED === 'true';

const DEFAULT_FETCH_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_FETCH_BYTES = 256 * 1024 * 1024;
// A data package is a descriptor and a few CSVs; a directory with hundreds of entries is not one
const MAX_PACKAGE_FILES = 100;
const IPFS_FETCH_TIMEOUT_MS = positiveInt(process.env.IPFS_FETCH_TIMEOUT_MS, DEFAULT_FETCH_TIMEOUT_MS);
const IPFS_MAX_FETCH_BYTES = positiveInt(process.env.IPFS_MAX_FETCH_BYTES, DEFAULT_MAX_FETCH_BYTES);

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** The parts of Helia and @helia/unixfs this service uses. Both are ESM-only, so they are imported on first use. */
interface HeliaNode {
  libp2p: { peerId: { toString(): string } };
  pins: { add(cid: unknown): Promise<unknown> | AsyncIterable<unknown> };
  stop(): Promise<void>;
}

interface UnixFs {
  addBytes(bytes: Uint8Array): Promise<unknown>;
  addDirectory(): Promise<unknown>;
  cp(source: unknown, target: unknown, name: string): Promise<unknown>;
  ls(cid: unknown, options?: { signal?: AbortSignal }): AsyncIterable<{ type: string; name: string; cid: unknown; size?: bigint }>;
  cat(cid: unknown, options?: { signal?: AbortSignal }): AsyncIterable<Uint8Array>;
}

class IpfsService {
  private node: HeliaNode | null = null;
  private ufs: UnixFs | null = null;
  // Two requests arriving before the node is up share one start, so the datastore lock is taken once
  private starting: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.node && this.ufs) return;
    if (!IPFS_ENABLED) throw new IpfsDisabledError();
    if (!this.starting) {
      this.starting = this.start().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  private async start(): Promise<void> {
    try {
      const { createHelia } = await import('helia');
      const { unixfs } = await import('@helia/unixfs');
      const { FsBlockstore } = await import('blockstore-fs');
      const { LevelDatastore } = await import('datastore-level');

      fs.mkdirSync(IPFS_BLOCKSTORE_PATH, { recursive: true });
      fs.mkdirSync(IPFS_DATASTORE_PATH, { recursive: true });

      const node = (await createHelia({
        blockstore: new FsBlockstore(IPFS_BLOCKSTORE_PATH),
        datastore: new LevelDatastore(IPFS_DATASTORE_PATH)
      })) as unknown as HeliaNode;
      this.node = node;
      this.ufs = unixfs(node as never) as unknown as UnixFs;
      log.info('Helia node started', { peerId: node.libp2p.peerId.toString() });
    } catch (error) {
      log.error('Failed to start the Helia node', { detail: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async ready(): Promise<{ node: HeliaNode; ufs: UnixFs }> {
    if (!IPFS_ENABLED) throw new IpfsDisabledError();
    await this.connect();
    return { node: this.node as HeliaNode, ufs: this.ufs as UnixFs };
  }

  /** Publishes the regular files directly inside `dirPath` as one IPFS directory, pins it and returns its CID. */
  async publishDirectory(dirPath: string): Promise<string> {
    const { node, ufs } = await this.ready();

    const files = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isSafePackageFileName(entry.name))
      .map((entry) => entry.name);
    if (files.length === 0) throw new Error('No files to publish');

    let dirCid = await ufs.addDirectory();
    for (const filename of files) {
      const content = fs.readFileSync(path.join(dirPath, filename));
      const fileCid = await ufs.addBytes(new Uint8Array(content));
      dirCid = await ufs.cp(fileCid, dirCid, filename);
    }
    await node.pins.add(dirCid);

    const cid = String(dirCid);
    log.info('Published directory to IPFS', { files: files.length, cid });
    return cid;
  }

  /**
   * Fetches the files of an IPFS directory into `outputDir` and returns their names. Gives up after the fetch
   * timeout, refuses packages over the size cap and any file name that is not a plain name.
   */
  async fetchDirectory(cidStr: string, outputDir: string): Promise<string[]> {
    const cid = await this.parseCid(cidStr);
    const { ufs } = await this.ready();
    const signal = AbortSignal.timeout(IPFS_FETCH_TIMEOUT_MS);
    fs.mkdirSync(outputDir, { recursive: true });

    const filenames: string[] = [];
    let totalBytes = 0;
    for await (const entry of ufs.ls(cid, { signal })) {
      if (entry.type !== 'file' && entry.type !== 'raw') continue;
      if (!isSafePackageFileName(entry.name)) throw new UnsafePackageError('The package holds a file whose name is not allowed');
      if (filenames.length >= MAX_PACKAGE_FILES) throw new UnsafePackageError(`The package holds more than ${MAX_PACKAGE_FILES} files`);

      const chunks: Uint8Array[] = [];
      for await (const chunk of ufs.cat(entry.cid, { signal })) {
        totalBytes += chunk.byteLength;
        if (totalBytes > IPFS_MAX_FETCH_BYTES) throw new PackageTooLargeError(IPFS_MAX_FETCH_BYTES);
        chunks.push(chunk);
      }
      fs.writeFileSync(resolveWithin(outputDir, entry.name), Buffer.concat(chunks));
      filenames.push(entry.name);
    }

    log.info('Fetched directory from IPFS', { files: filenames.length, bytes: totalBytes, cid: cidStr });
    return filenames;
  }

  /** Reads one file by CID, up to the size cap. */
  async cat(cidStr: string): Promise<Buffer> {
    const cid = await this.parseCid(cidStr);
    const { ufs } = await this.ready();
    const signal = AbortSignal.timeout(IPFS_FETCH_TIMEOUT_MS);

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    for await (const chunk of ufs.cat(cid, { signal })) {
      totalBytes += chunk.byteLength;
      if (totalBytes > IPFS_MAX_FETCH_BYTES) throw new PackageTooLargeError(IPFS_MAX_FETCH_BYTES);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  private async parseCid(value: string): Promise<unknown> {
    if (!isValidCid(value)) throw new InvalidCidError();
    const { CID } = await import('multiformats/cid');
    try {
      return CID.parse(value);
    } catch {
      throw new InvalidCidError();
    }
  }

  getGatewayUrl(cidStr: string): string {
    return `${IPFS_GATEWAY_URL}/${cidStr}`;
  }

  isEnabled(): boolean {
    return IPFS_ENABLED;
  }

  isConnected(): boolean {
    return this.node !== null;
  }

  async healthCheck(): Promise<boolean> {
    if (!IPFS_ENABLED) return false;
    try {
      await this.connect();
      return this.node !== null;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (!this.node) return;
    await this.node.stop();
    this.node = null;
    this.ufs = null;
    log.info('Helia node stopped');
  }
}

export const ipfsService = new IpfsService();
