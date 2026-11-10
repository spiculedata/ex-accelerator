// A session that expires while a page is open makes every data request answer 401, and each page reports that as
// its own vague failure. Watching fetch lets the app say once, plainly, that the visitor needs to sign in again.

import { writable } from 'svelte/store';

/** True once a request has shown that the visitor's session is over. */
export const sessionExpired = writable(false);

const SIGN_IN_PREFIX = '/api/auth/';

function appApiPath(input: RequestInfo | URL, origin: string): string | null {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(raw, origin);
    return url.origin === origin && url.pathname.startsWith('/api/') ? url.pathname : null;
  } catch {
    return null;
  }
}

/** Calls `onExpired` when a request to the app's own API answers 401 (a failed sign-in does not count). Returns a function that undoes the watch. */
export function watchForExpiredSession(target: { fetch: typeof fetch }, onExpired: () => void, origin = 'http://localhost'): () => void {
  const original = target.fetch;
  target.fetch = async (input, init) => {
    const response = await original(input, init);
    const path = appApiPath(input, origin);
    if (response.status === 401 && path && !path.startsWith(SIGN_IN_PREFIX)) onExpired();
    return response;
  };
  return () => {
    target.fetch = original;
  };
}
