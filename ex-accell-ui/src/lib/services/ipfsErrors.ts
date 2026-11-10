// Failures the IPFS service reports by type, so routes can answer with the right status without reading messages.

/** Peer-to-peer sharing is turned off on this server (IPFS_ENABLED is not "true"). */
export class IpfsDisabledError extends Error {
  constructor() {
    super('Peer-to-peer sharing is turned off on this server. Set IPFS_ENABLED=true to turn it on.');
    this.name = 'IpfsDisabledError';
  }
}

/** The value is not an IPFS content identifier. */
export class InvalidCidError extends Error {
  constructor() {
    super('Not a valid IPFS CID');
    this.name = 'InvalidCidError';
  }
}

/** A fetched package holds something that must not be written to disk, such as a file name with a path in it. */
export class UnsafePackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafePackageError';
  }
}

/** A fetched package is bigger than this server allows. */
export class PackageTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`The package is larger than the ${Math.round(maxBytes / (1024 * 1024))}MB this server accepts`);
    this.name = 'PackageTooLargeError';
  }
}
