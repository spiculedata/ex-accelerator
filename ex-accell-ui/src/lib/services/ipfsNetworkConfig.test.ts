// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { libp2pDefaults } from 'helia';
import { buildLibp2pOverrides, readNetworkConfig, NetworkConfigError } from './ipfsNetworkConfig';

describe('readNetworkConfig', () => {
  it('leaves everything at libp2p defaults when nothing is set', () => {
    expect(readNetworkConfig({})).toEqual({ listen: null, announce: null, upnp: true, relayServer: true, autoTls: true });
  });

  it('reads comma-separated multiaddrs, trimming blanks', () => {
    const config = readNetworkConfig({
      IPFS_LISTEN_ADDRS: ' /ip4/0.0.0.0/tcp/4001 , /ip4/0.0.0.0/tcp/4002/ws,, ',
      IPFS_ANNOUNCE_ADDRS: '/dns4/node.example.org/tcp/4001'
    });

    expect(config.listen).toEqual(['/ip4/0.0.0.0/tcp/4001', '/ip4/0.0.0.0/tcp/4002/ws']);
    expect(config.announce).toEqual(['/dns4/node.example.org/tcp/4001']);
  });

  it('treats a blank list as unset', () => {
    expect(readNetworkConfig({ IPFS_LISTEN_ADDRS: '  ', IPFS_ANNOUNCE_ADDRS: '' })).toMatchObject({ listen: null, announce: null });
  });

  it.each(['tcp/4001', '/ip4/0.0.0.0/tcp/4001 /ip4/1.2.3.4', 'http://example.org', '/ip4/0.0.0.0/tcp/4001;rm', '//'])(
    'refuses %j as a multiaddr, naming the variable',
    (value) => {
      expect(() => readNetworkConfig({ IPFS_LISTEN_ADDRS: value })).toThrow(NetworkConfigError);
      expect(() => readNetworkConfig({ IPFS_ANNOUNCE_ADDRS: value })).toThrow(/IPFS_ANNOUNCE_ADDRS/);
    }
  );

  it('turns a feature off only for the exact string "false"', () => {
    expect(readNetworkConfig({ IPFS_UPNP: 'false', IPFS_RELAY_SERVER: 'false', IPFS_AUTOTLS: 'false' })).toMatchObject({
      upnp: false,
      relayServer: false,
      autoTls: false
    });
    for (const value of ['FALSE', '0', 'no', '', 'true']) {
      expect(readNetworkConfig({ IPFS_UPNP: value, IPFS_RELAY_SERVER: value, IPFS_AUTOTLS: value })).toMatchObject({
        upnp: true,
        relayServer: true,
        autoTls: true
      });
    }
  });
});

describe('buildLibp2pOverrides', () => {
  const defaults = {
    addresses: { listen: ['/ip4/0.0.0.0/tcp/0', '/p2p-circuit'] },
    services: { upnp: 'u', relay: 'r', autoTLS: 'a', dht: 'd', identify: 'i' }
  };
  const base = { listen: null, announce: null, upnp: true, relayServer: true, autoTls: true };

  it('returns null when nothing differs from the defaults, so the node is built exactly as before', () => {
    expect(buildLibp2pOverrides(defaults, base)).toBeNull();
  });

  it('replaces only the listen addresses, keeping everything else', () => {
    const overrides = buildLibp2pOverrides(defaults, { ...base, listen: ['/ip4/0.0.0.0/tcp/4001'] });

    expect(overrides).toEqual({ addresses: { listen: ['/ip4/0.0.0.0/tcp/4001'] } });
  });

  it('adds announce addresses next to the default listen addresses', () => {
    const overrides = buildLibp2pOverrides(defaults, { ...base, announce: ['/dns4/a.example/tcp/4001'] });

    expect(overrides).toEqual({ addresses: { listen: defaults.addresses.listen, announce: ['/dns4/a.example/tcp/4001'] } });
  });

  it('removes just the services that were switched off', () => {
    const overrides = buildLibp2pOverrides(defaults, { ...base, upnp: false, relayServer: false });

    expect(overrides).toEqual({ services: { autoTLS: 'a', dht: 'd', identify: 'i' } });
    expect(defaults.services).toHaveProperty('upnp'); // the defaults object is not mutated
  });
});

describe('against the installed Helia', () => {
  // These options name parts of libp2p's default configuration. If an upgrade renames them, the switches would silently
  // stop working, so this fails instead.
  const real = libp2pDefaults() as unknown as { addresses: { listen: string[] }; services: Record<string, unknown> };

  it('still has the services the switches remove, and a listen list to replace', () => {
    expect(Object.keys(real.services)).toEqual(expect.arrayContaining(['upnp', 'relay', 'autoTLS']));
    expect(real.addresses.listen.length).toBeGreaterThan(0);
  });

  it('keeps every other service when switches are off', () => {
    const overrides = buildLibp2pOverrides(real, { listen: null, announce: null, upnp: false, relayServer: false, autoTls: false });
    const kept = Object.keys(overrides?.services ?? {});

    expect(kept).not.toEqual(expect.arrayContaining(['upnp']));
    expect(kept).toEqual(expect.arrayContaining(['dht', 'identify', 'ping']));
    expect(kept).toHaveLength(Object.keys(real.services).length - 3);
  });
});
