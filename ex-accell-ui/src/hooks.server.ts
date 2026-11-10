import type { Handle } from '@sveltejs/kit';
import { decideAccess } from '$lib/server/auth/guard';
import { SESSION_COOKIE, getAuthConfig } from '$lib/server/auth/runtime';
import { readSessionToken } from '$lib/server/auth/session';
import { isSessionCurrent } from '$lib/server/auth/revocation';
import { preloadFont } from '$lib/server/fontPreload';
import { checkAccess } from '$lib/server/auth/accessCheck';
import { resourcesInRequest } from '$lib/server/auth/access';
import { isCrossSiteWrite, requestHosts } from '$lib/server/auth/csrf';
import { createRateLimiter, parseRateLimit } from '$lib/server/rateLimit';

const denial = (error: string, status: number) =>
  new Response(JSON.stringify({ success: false, data: null, error }), {
    status,
    headers: { 'content-type': 'application/json' }
  });

// A limit on API requests per signed-in person. Anonymous requests are not counted: behind a proxy that hides client
// addresses they would all share one counter, so one noisy client could lock everyone out of signing in, and sign-in has
// its own per-address and per-account limits. API_RATE_LIMIT_PER_MINUTE=0 turns it off.
const apiLimiter = createRateLimiter({ limit: parseRateLimit(process.env.API_RATE_LIMIT_PER_MINUTE), windowMs: 60_000 });
const RATE_LIMIT_EXEMPT = new Set(['/api/health']);

const BASELINE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
const HSTS_VALUE = 'max-age=15552000; includeSubDomains';

/** Adds security headers to any response (routes, denials and redirects alike). */
function withSecurityHeaders(response: Response, isSecure: boolean): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASELINE_SECURITY_HEADERS)) headers.set(name, value);
  // A page that needed a sign-in must not be kept by the browser, or Back after signing out would show it again
  if (headers.get('content-type')?.startsWith('text/html')) headers.set('Cache-Control', 'no-store');
  // Only send HSTS when the site is served over HTTPS (the same signal as the Secure cookie flag)
  if (isSecure) headers.set('Strict-Transport-Security', HSTS_VALUE);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Pages that are refused are shown a plain page, not JSON. */
const forbiddenPage = () =>
  new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>No access - Social Explorer</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>You do not have access to this</h1><p>It belongs to a project you are not a member of. Ask a member to add you, or go back to <a href="/">Home</a>.</p></body></html>',
    { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );

/**
 * A signed-in user may only open projects and workspaces they are a member of (admins: all). The request names the
 * resource in its path or query string; ids sent in a request body are checked by the route that reads them.
 */
async function refuseUnlessMember(event: Parameters<Handle>[0]['event']): Promise<Response | null> {
  const user = event.locals.user;
  if (!user) return null; // a public route reached while signed out
  const resources = resourcesInRequest(event.url);
  // An id that is not a plain whole number is refused, not ignored: a route may read it more loosely than this does
  if (resources.malformed.length > 0) return denial('Invalid project or workspace id', 400);
  if (resources.projects.length === 0 && resources.workspaces.length === 0) return null;
  try {
    const result = await checkAccess(user, resources);
    if (result.allowed) return null;
    return event.url.pathname.startsWith('/api/')
      ? denial(`You do not have access to this ${result.what}`, 403)
      : forbiddenPage();
  } catch {
    return denial('The service is temporarily unavailable. Try again in a moment.', 503);
  }
}

const authorize: Handle = async ({ event, resolve }) => {
  // A write sent by a page on another site is refused before anything else, signed in or not
  if (isCrossSiteWrite(event.request, requestHosts(event.request, event.url, process.env.ORIGIN))) {
    return denial('Cross-site requests are not allowed', 403);
  }

  const { sessionSecret } = getAuthConfig();
  // A valid signature is not enough: the session must also be the user's current one (not signed out everywhere, not
  // from before a password change, and the user must still exist)
  const session = readSessionToken(event.cookies.get(SESSION_COOKIE), sessionSecret);
  const status = session ? await isSessionCurrent(session.user.id, session.sessionVersion) : 'revoked';
  event.locals.user = session && status === 'current' ? session.user : null;
  // On a revoked session the browser's cookie is cleared when the response is rendered (the sign-in page does that); a
  // redirect or denial built below carries no cookie changes. An outage ('unknown') never clears anything.
  if (session && status === 'revoked') event.cookies.delete(SESSION_COOKIE, { path: '/' });

  if (event.locals.user && event.url.pathname.startsWith('/api/') && !RATE_LIMIT_EXEMPT.has(event.url.pathname)) {
    const verdict = apiLimiter.hit(`user:${event.locals.user.id}`);
    if (!verdict.allowed) {
      const limited = denial('Too many requests. Slow down and try again shortly.', 429);
      limited.headers.set('Retry-After', String(verdict.retryAfterSeconds));
      return limited;
    }
  }

  const decision = decideAccess({
    pathname: event.url.pathname,
    search: event.url.search,
    method: event.request.method,
    user: event.locals.user
  });

  // The session could not be checked (the database is unreachable): say so instead of pretending the user signed out
  if (status === 'unknown' && decision.action !== 'allow') return denial('The service is temporarily unavailable. Try again in a moment.', 503);

  switch (decision.action) {
    case 'redirect':
      return new Response(null, { status: 303, headers: { location: decision.location } });
    case 'unauthorized':
      return denial('Authentication required', 401);
    case 'forbidden':
      return denial('You do not have permission to perform this action', 403);
    default: {
      const refused = await refuseUnlessMember(event);
      if (refused) return refused;
      return resolve(event, { preload: preloadFont });
    }
  }
};

export const handle: Handle = async (input) =>
  withSecurityHeaders(await authorize(input), getAuthConfig().secureCookies);
