// Cross-site request forgery: a page on another site can make the browser send a signed-in user's cookie with a write.
// SameSite=Lax already withholds the cookie from most of those, but the check is made explicit here as well, because
// it is cheap and does not depend on every browser and every cookie setting being what we expect.

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** The hosts this app is reachable at for one request: the URL's, the Host header and, behind a proxy, X-Forwarded-Host. */
export function requestHosts(request: Request, url: URL): string[] {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return [url.host, request.headers.get('host'), forwarded].filter((host): host is string => !!host);
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
