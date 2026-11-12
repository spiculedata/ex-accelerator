import type { SessionUser } from './session';

export type AccessDecision =
  | { action: 'allow' }
  | { action: 'redirect'; location: string }
  | { action: 'unauthorized' }
  | { action: 'forbidden' };

export interface AccessRequest {
  pathname: string;
  search: string;
  method: string;
  user: SessionUser | null;
}

const LOGIN_PATH = '/login';
const PUBLIC_EXACT = new Set([LOGIN_PATH, '/api/auth/login', '/api/auth/logout', '/api/health']);
const PUBLIC_PATTERNS = [/^\/_app\//, /^\/favicon\.(svg|ico|png)$/];
// Needs a session but is open to every role: these only affect the caller's own account, which a read-only viewer may manage too
const SELF_SERVICE = new Set(['/api/auth/logout-all', '/api/auth/password']);
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Endpoints that deploy or run code, start processes or manage user accounts are admin-only. */
const ADMIN_ONLY_PATTERNS = [
  /^\/api\/users(\/|$)/,
  /^\/settings\/users(\/|$)/,
  /^\/api\/deploy-workflow(\/|$)/,
  /^\/api\/generate-python-workflow(\/|$)/,
  /^\/api\/jupyter(\/|$)/,
  /^\/api\/workflows\/[^/]+\/execute(\/|$)/,
  // Raw SQL runs with the app's full database rights. `seed` no longer exists; it stays listed as defence in depth.
  /^\/api\/unified-analytics\/(query|seed)(\/|$)/
];

/**
 * Starting a workflow is admin-only, so cancelling or controlling a running one is too. Reading them stays open.
 * Publishing a dataset to IPFS puts it on a public network for good, withdrawing one changes what the node serves, and
 * importing one creates tables with the app's full database rights, so all three (every non-read method on the route)
 * are admin-only; listing packages and the registry stays open.
 */
const ADMIN_ONLY_WRITE_PATTERNS = [/^\/api\/workflow-executions(\/|$)/, /^\/api\/data-sharing(\/|$)/];

/**
 * `event.url.pathname` stays percent-encoded while SvelteKit routes on the decoded path, so
 * `/api/%64eploy-workflow` reaches the deploy handler. Match the patterns against the decoded,
 * slash-collapsed form as well as the raw one.
 */
function pathVariants(pathname: string): string[] {
  try {
    return [pathname, decodeURIComponent(pathname).replace(/\/{2,}/g, '/')];
  } catch {
    return [pathname];
  }
}

function isAdminOnly(pathname: string, verb: string): boolean {
  const patterns = READ_METHODS.has(verb) ? ADMIN_ONLY_PATTERNS : [...ADMIN_ONLY_PATTERNS, ...ADMIN_ONLY_WRITE_PATTERNS];
  return pathVariants(pathname).some((path) => patterns.some((pattern) => pattern.test(path)));
}

function isPublic(pathname: string): boolean {
  if (pathname.includes('..')) return false;
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PATTERNS.some((pattern) => pattern.test(pathname));
}

/** Returns a same-origin path to redirect to after login, or `/` if the target is unsafe. */
export function safeRedirectTarget(target: string | null | undefined): string {
  if (typeof target !== 'string') return '/';
  const isLocalPath = /^\/(?![/\\])[^\x00-\x1f\\]*$/.test(target);
  return isLocalPath && !target.startsWith(LOGIN_PATH) ? target : '/';
}

/** Decides what to do with a request before any route code runs. */
export function decideAccess({ pathname, search, method, user }: AccessRequest): AccessDecision {
  const verb = method.toUpperCase();
  const isApi = pathname.startsWith('/api/');

  if (!user) {
    if (isPublic(pathname)) return { action: 'allow' };
    if (isApi || !READ_METHODS.has(verb)) return { action: 'unauthorized' };
    return { action: 'redirect', location: `${LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}` };
  }

  if (pathname === LOGIN_PATH) return { action: 'redirect', location: '/' };
  if (user.role !== 'admin' && isAdminOnly(pathname, verb)) {
    return { action: 'forbidden' };
  }
  if (user.role === 'viewer' && !READ_METHODS.has(verb) && !isPublic(pathname) && !SELF_SERVICE.has(pathname)) {
    return { action: 'forbidden' };
  }
  return { action: 'allow' };
}
