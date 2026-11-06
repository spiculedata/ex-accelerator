import type { Handle } from '@sveltejs/kit';
import { decideAccess } from '$lib/server/auth/guard';
import { SESSION_COOKIE, getAuthConfig } from '$lib/server/auth/runtime';
import { verifySessionToken } from '$lib/server/auth/session';

const denial = (error: string, status: number) =>
  new Response(JSON.stringify({ success: false, data: null, error }), {
    status,
    headers: { 'content-type': 'application/json' }
  });

export const handle: Handle = async ({ event, resolve }) => {
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
