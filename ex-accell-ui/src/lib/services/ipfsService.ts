// IPFS P2P Data Sharing Service (Helia)
// Provides content-addressed publishing and fetching of Frictionless Data Packages

import fs from 'fs';
import path from 'path';

const IPFS_BLOCKSTORE_PATH = process.env.IPFS_BLOCKSTORE_PATH || '/data/ipfs/blocks';
const IPFS_DATASTORE_PATH = process.env.IPFS_DATASTORE_PATH || '/data/ipfs/datastore';
const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs';
const IPFS_ENABLED = process.env.IPFS_ENABLED !== 'false';

class IpfsService {
  private node: any = null;
  private ufs: any = null;
  private initialized = false;

  async connect(): Promise<void> {
    if (this.initialized && this.node) return;
    if (!IPFS_ENABLED) throw new Error('IPFS is disabled (set IPFS_ENABLED=true)');

    try {
      // Dynamic imports — Helia is ESM-only
      const { createHelia } = await import('helia');
      const { unixfs } = await import('@helia/unixfs');
      const { FsBlockstore } = await import('blockstore-fs');
      const { LevelDatastore } = await import('datastore-level');

      // Ensure storage directories exist
      fs.mkdirSync(IPFS_BLOCKSTORE_PATH, { recursive: true });
      fs.mkdirSync(IPFS_DATASTORE_PATH, { recursive: true });

      const blockstore = new FsBlockstore(IPFS_BLOCKSTORE_PATH);
      const datastore = new LevelDatastore(IPFS_DATASTORE_PATH);

      this.node = await createHelia({ blockstore, datastore });
      this.ufs = unixfs(this.node);
      this.initialized = true;

      console.log('IPFS/Helia node initialized');
      console.log('  PeerId:', this.node.libp2p.peerId.toString());
    } catch (error: any) {
      console.error('Failed to initialize IPFS/Helia:', error.message);
      throw error;
    }
  }

  /**
   * Publish a local directory (datapackage.json + CSVs) to IPFS.
   * Returns the root directory CID as a string.
   */
  async publishDirectory(dirPath: string): Promise<string> {
    if (!this.initialized) await this.connect();

    const files = fs.readdirSync(dirPath).filter(f => {
      const stat = fs.statSync(path.join(dirPath, f));
      return stat.isFile();
    });

    if (files.length === 0) throw new Error('No files to publish');

    // Add each file to IPFS
    const fileEntries: { name: string; cid: any }[] = [];
    for (const filename of files) {
      const content = fs.readFileSync(path.join(dirPath, filename));
      const cid = await this.ufs.addBytes(new Uint8Array(content));
      fileEntries.push({ name: filename, cid });
    }

    // Build a directory containing all files
    let dirCid = await this.ufs.addDirectory();
    for (const entry of fileEntries) {
      dirCid = await this.ufs.cp(entry.cid, dirCid, entry.name);
    }

    // Pin to ensure persistence
    await this.node.pins.add(dirCid);

    const cidStr = dirCid.toString();
    console.log(`Published ${files.length} files to IPFS: ${cidStr}`);
    return cidStr;
  }

  /**
   * Fetch a directory from IPFS by CID and write files to outputDir.
   * Returns list of fetched filenames.
   */
  async fetchDirectory(cidStr: string, outputDir: string): Promise<string[]> {
    if (!this.initialized) await this.connect();

    const { CID } = await import('multiformats/cid');
    const cid = CID.parse(cidStr);

    fs.mkdirSync(outputDir, { recursive: true });

    const filenames: string[] = [];

    for await (const entry of this.ufs.ls(cid)) {
      if (entry.type === 'file' || entry.type === 'raw') {
        const chunks: Uint8Array[] = [];
        for await (const chunk of this.ufs.cat(entry.cid)) {
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks);
        const filePath = path.join(outputDir, entry.name);
        fs.writeFileSync(filePath, content);
        filenames.push(entry.name);
      }
    }

    console.log(`Fetched ${filenames.length} files from IPFS CID ${cidStr}`);
    return filenames;
  }

  /**
   * Fetch a single file from IPFS by CID.
   */
  async cat(cidStr: string): Promise<Buffer> {
    if (!this.initialized) await this.connect();

    const { CID } = await import('multiformats/cid');
    const cid = CID.parse(cidStr);

    const chunks: Uint8Array[] = [];
    for await (const chunk of this.ufs.cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  getGatewayUrl(cidStr: string): string {
    return `${IPFS_GATEWAY_URL}/${cidStr}`;
  }

  isEnabled(): boolean {
    return IPFS_ENABLED;
  }

  isConnected(): boolean {
    return this.initialized && this.node !== null;
  }

  async healthCheck(): Promise<boolean> {
    if (!IPFS_ENABLED) return false;
    try {
      if (!this.initialized) await this.connect();
      return this.node !== null;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.node = null;
      this.ufs = null;
      this.initialized = false;
      console.log('IPFS/Helia node stopped');
    }
  }
}

export const ipfsService = new IpfsService();
