import type { Handle } from '@sveltejs/kit';
import { decideAccess } from '$lib/server/auth/guard';
import { SESSION_COOKIE, getAuthConfig } from '$lib/server/auth/runtime';
import { verifySessionToken } from '$lib/server/auth/session';

const denial = (error: string, status: number) =>
  new Response(JSON.stringify({ success: false, data: null, error }), {
    status,
    headers: { 'content-type': 'application/json' }
  });

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

const authorize: Handle = async ({ event, resolve }) => {
  const { sessionSecret } = getAuthConfig();
  event.locals.user = verifySessionToken(event.cookies.get(SESSION_COOKIE), sessionSecret);

  const decision = decideAccess({
    pathname: event.url.pathname,
    search: event.url.search,
    method: event.request.method,
    user: event.locals.user
  });

  switch (decision.action) {
    case 'redirect':
      return new Response(null, { status: 303, headers: { location: decision.location } });
    case 'unauthorized':
      return denial('Authentication required', 401);
    case 'forbidden':
      return denial('You do not have permission to perform this action', 403);
    default:
      return resolve(event);
  }
};

export const handle: Handle = async (input) =>
  withSecurityHeaders(await authorize(input), getAuthConfig().secureCookies);
