// What an IPFS content identifier looks like, checked before a value reaches the network, the registry or a URL.

// CIDv0 is base58btc starting "Qm"; CIDv1 as Helia produces it is base32 starting "b". Other multibase prefixes are
// not accepted: the registry and the gateway URL only ever see these two.
const CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,200})$/;

/** True when the value looks like an IPFS CID. `CID.parse` makes the final call when the network is asked. */
export function isValidCid(value: unknown): value is string {
  return typeof value === 'string' && CID_PATTERN.test(value);
}
