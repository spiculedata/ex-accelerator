// Fetching an address a visitor typed in must never reach the server's own network: loopback, private ranges, link-local
// addresses (cloud metadata is 169.254.169.254) and the like. Each hop of a redirect is checked as well.
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(message = 'That address points to a private or internal network, so it cannot be analysed.') {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const MAX_REDIRECTS = 5;

function ipv4Public(octets: number[]): boolean {
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, including cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF protocol and documentation ranges
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return a < 224; // multicast and reserved start at 224
}

/** The 16 bytes of an IPv6 address, or null when it is not one. */
function ipv6Bytes(address: string): number[] | null {
  let text = address.toLowerCase();
  // An embedded IPv4 tail (::ffff:1.2.3.4) becomes two groups
  const tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (tail) {
    const v = tail.slice(1).map(Number);
    if (v.some((n) => n > 255)) return null;
    text = text.slice(0, tail.index) + ((v[0] << 8) | v[1]).toString(16) + ':' + ((v[2] << 8) | v[3]).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const group of groups) {
    const value = parseInt(group, 16);
    if (!/^[0-9a-f]{1,4}$/.test(group) || Number.isNaN(value)) return null;
    bytes.push(value >> 8, value & 255);
  }
  return bytes;
}

function ipv6Public(bytes: number[]): boolean {
  const mapped = bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 255 && bytes[11] === 255;
  if (mapped) return ipv4Public(bytes.slice(12));
  // Only global unicast (2000::/3) is public, and not its special-purpose blocks: Teredo, documentation, 6to4
  if ((bytes[0] & 0xe0) !== 0x20) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && bytes[3] === 0) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false;
  return true;
}

/** True only for an IP address on the public internet. Anything else, including a hostname, is false. */
export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return ipv4Public(address.split('.').map(Number));
  if (family === 6) {
    const bytes = ipv6Bytes(address);
    return bytes !== null && ipv6Public(bytes);
  }
  return false;
}

export interface FetchDeps {
  lookup?: (host: string) => Promise<{ address: string; family: number }[]>;
  fetchImpl?: typeof fetch;
}

const defaultLookup = (host: string) => dnsLookup(host, { all: true });

async function assertPublic(url: URL, lookup: NonNullable<FetchDeps['lookup']>): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http:// and https:// addresses can be analysed.');
  if (url.username || url.password) throw new UnsafeUrlError('Addresses with a user name or password cannot be analysed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) throw new UnsafeUrlError();
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new UnsafeUrlError();
    return;
  }
  const answers = await lookup(host);
  if (answers.length === 0 || answers.some((answer) => !isPublicIp(answer.address))) throw new UnsafeUrlError();
}

/**
 * fetch for an address a visitor supplied: every hop (the first address and each redirect) must resolve only to public
 * addresses. A name could in principle resolve differently between this check and the connection; the check closes the
 * direct and redirect routes, not that race.
 */
export async function fetchPublic(input: string, init: RequestInit = {}, deps: FetchDeps = {}): Promise<Response> {
  const lookup = deps.lookup ?? defaultLookup;
  const fetchImpl = deps.fetchImpl ?? fetch;
  let current = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(current, lookup);
    const response = await fetchImpl(current.toString(), { ...init, redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error('The address redirected too many times.');
}
