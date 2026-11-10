// Fetching an address a visitor typed in must never reach the server's own network: loopback, private ranges, link-local
// addresses (cloud metadata is 169.254.169.254) and the like. Each hop of a redirect is checked as well.
import { lookup as dnsLookup } from 'node:dns/promises';
import { lookup as nodeLookup } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

const PRIVATE_MESSAGE = 'That address points to a private or internal network, so it cannot be analysed.';
// For a name, the same words as any other download failure, so the answer does not reveal what a name resolves to
const GENERIC_MESSAGE = 'The image could not be downloaded. Check the address, and that the site allows downloads.';

export class UnsafeUrlError extends Error {
  constructor(message = PRIVATE_MESSAGE) {
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
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay
  if (a === 168 && b === 63 && c === 129 && octets[3] === 16) return false; // Azure's platform endpoint
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
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) throw new UnsafeUrlError();
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new UnsafeUrlError();
    return;
  }
  const answers = await lookup(host);
  if (answers.length === 0 || answers.some((answer) => !isPublicIp(answer.address))) throw new UnsafeUrlError(GENERIC_MESSAGE);
}

type LookupCallback = (error: Error | null, address?: unknown, family?: number) => void;

/**
 * The check made at connection time, on the addresses the connection will really use, so a name cannot answer
 * differently after it was checked (DNS rebinding) and a URL read differently by two parsers cannot slip through.
 */
export function guardedLookup(hostname: string, options: { all?: boolean } & Record<string, unknown>, callback: LookupCallback, resolver: typeof nodeLookup = nodeLookup): void {
  (resolver as any)(hostname, { ...options, all: true }, (error: Error | null, addresses: { address: string; family: number }[]) => {
    if (error) return callback(error);
    if (!addresses || addresses.length === 0 || addresses.some((a) => !isPublicIp(a.address))) return callback(new UnsafeUrlError(GENERIC_MESSAGE));
    return options.all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family);
  });
}

const guardedAgent = new Agent({ connect: { lookup: guardedLookup as any } });
const guardedFetch = ((url: RequestInfo | URL, init?: RequestInit) => undiciFetch(url as any, { ...(init as any), dispatcher: guardedAgent })) as unknown as typeof fetch;

export class TooLargeError extends Error {
  constructor() {
    super('Image too large (max 10MB). Use a smaller image or resize first.');
    this.name = 'TooLargeError';
  }
}

/** Reads a body but gives up as soon as it passes `maxBytes`, so a huge or endless response cannot fill memory. */
export async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new TooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * fetch for an address a visitor supplied: every hop (the first address and each redirect) must resolve only to public
 * addresses, and the connection itself is checked again (guardedLookup).
 */
export async function fetchPublic(input: string, init: RequestInit = {}, deps: FetchDeps = {}): Promise<Response> {
  const lookup = deps.lookup ?? defaultLookup;
  const fetchImpl = deps.fetchImpl ?? guardedFetch;
  let current = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(current, lookup);
    // Identity encoding: a small compressed body cannot inflate past the size cap
    const response = await fetchImpl(current.toString(), { ...init, redirect: 'manual', headers: { ...(init.headers as Record<string, string>), 'Accept-Encoding': 'identity' } });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel(); // release the connection of a response nobody will read
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error('The address redirected too many times.');
}
