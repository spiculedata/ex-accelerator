// Cross-site request forgery: a page on another site can make the browser send a signed-in user's cookie with a write.
// SameSite=Lax already withholds the cookie from most of those, but the check is made explicit here as well, because
// it is cheap and does not depend on every browser and every cookie setting being what we expect.

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Lower-cased, with a default port dropped (an Origin's own host is normalised the same way by the URL parser)
const hostOf = (value: string): string | null => {
  const host = value.trim().toLowerCase().replace(/:(80|443)$/, '');
  return /^[a-z0-9.\-\[\]:]+$/.test(host) && host.length > 0 ? host : null;
};

/**
 * The hosts this app is reachable at for one request. When `ORIGIN` is configured it is the only one, a fixed allow-list
 * that a forwarded or rebound host cannot widen. Otherwise: the URL's host, the Host header and, behind a proxy,
 * X-Forwarded-Host (a client can only set that for its own requests, never for a victim's browser).
 */
export function requestHosts(request: Request, url: URL, configuredOrigin?: string): string[] {
  if (configuredOrigin) {
    try {
      return [new URL(configuredOrigin).host.toLowerCase()];
    } catch {
      // Not a URL: fall back to the request's own hosts rather than locking everyone out
    }
  }
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return [url.host, request.headers.get('host'), forwarded]
    .filter((host): host is string => !!host)
    .map((host) => hostOf(host))
    .filter((host): host is string => host !== null);
}

/**
 * True when a state-changing request was sent by a page on another site. Uses the headers browsers attach themselves:
 * `Sec-Fetch-Site`, and `Origin`, whose host must be one the app is served from (the host, not the scheme, so a proxy that
 * terminates TLS does not cause false alarms). A request with neither (a script, curl) is not made by a browser carrying
 * the user's cookie, so it is not a forgery.
 */
export function isCrossSiteWrite(request: Request, appHosts: string[]): boolean {
  if (!WRITE_METHODS.has(request.method.toUpperCase())) return false;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;
  const origin = request.headers.get('origin');
  if (origin === null) return false;
  try {
    return !appHosts.includes(new URL(origin).host);
  } catch {
    return true; // "null" and anything unparseable
  }
}
