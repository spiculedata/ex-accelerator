// Network behaviour of the Helia node, read from the environment. Everything defaults to libp2p's own defaults, so an
// install that sets none of these variables builds exactly the node it always did.
//
// Only options the installed Helia/libp2p support are used: `addresses.listen` and `addresses.announce`, and removing the
// `upnp`, `relay` (circuit relay server) and `autoTLS` entries from the services map that `libp2pDefaults()` returns.
// mDNS, the bootstrap list, the delegated-routing client and the HTTP gateways cannot be switched off through Helia's
// options without taking direct dependencies on the packages behind them, so they are not configurable here.

export class NetworkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkConfigError';
  }
}

export interface NetworkConfig {
  /** Replaces the default listen addresses, or null to keep them. */
  listen: string[] | null;
  /** Addresses announced to the network instead of the ones the transports report, or null for none. */
  announce: string[] | null;
  upnp: boolean;
  relayServer: boolean;
  autoTls: boolean;
}

/** The parts of libp2p's default configuration that are changed here. */
interface Libp2pDefaultsShape {
  addresses: { listen?: string[] };
  services: Record<string, unknown>;
}

export interface Libp2pOverrides {
  addresses?: { listen?: string[]; announce?: string[] };
  services?: Record<string, unknown>;
}

// A multiaddr is a slash-separated path of protocol names and values: /ip4/0.0.0.0/tcp/4001, /dns4/host/tcp/4001/ws
const MULTIADDR_PATTERN = /^(\/[A-Za-z0-9._:%~-]+)+$/;

function parseMultiaddrs(name: string, value: string | undefined): string[] | null {
  const addrs = (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (addrs.length === 0) return null;
  const invalid = addrs.find((addr) => !MULTIADDR_PATTERN.test(addr));
  if (invalid !== undefined) throw new NetworkConfigError(`${name} holds a value that is not a multiaddr: ${JSON.stringify(invalid)}`);
  return addrs;
}

/** Only the exact string "false" turns a feature off, like IPFS_ENABLED only turns on for "true". */
const isNotDisabled = (value: string | undefined): boolean => value !== 'false';

export function readNetworkConfig(env: Record<string, string | undefined>): NetworkConfig {
  return {
    listen: parseMultiaddrs('IPFS_LISTEN_ADDRS', env.IPFS_LISTEN_ADDRS),
    announce: parseMultiaddrs('IPFS_ANNOUNCE_ADDRS', env.IPFS_ANNOUNCE_ADDRS),
    upnp: isNotDisabled(env.IPFS_UPNP),
    relayServer: isNotDisabled(env.IPFS_RELAY_SERVER),
    autoTls: isNotDisabled(env.IPFS_AUTOTLS)
  };
}

/**
 * The libp2p options to pass to `createHelia` on top of its defaults, or null when the configuration is the default.
 * `defaults` is left untouched. Passing `services` replaces the whole map, so it is the defaults minus what is off.
 */
export function buildLibp2pOverrides(defaults: Libp2pDefaultsShape, config: NetworkConfig): Libp2pOverrides | null {
  const overrides: Libp2pOverrides = {};

  if (config.listen !== null || config.announce !== null) {
    overrides.addresses = {
      listen: config.listen ?? defaults.addresses.listen,
      ...(config.announce !== null ? { announce: config.announce } : {})
    };
  }

  const switchedOff = [
    ...(config.upnp ? [] : ['upnp']),
    ...(config.relayServer ? [] : ['relay']),
    ...(config.autoTls ? [] : ['autoTLS'])
  ];
  if (switchedOff.length > 0) {
    overrides.services = Object.fromEntries(Object.entries(defaults.services).filter(([name]) => !switchedOff.includes(name)));
  }

  return Object.keys(overrides).length > 0 ? overrides : null;
}
