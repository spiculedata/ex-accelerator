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
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Endpoints that deploy or run code, or start processes, are admin-only. */
const ADMIN_ONLY_PATTERNS = [
  /^\/api\/deploy-workflow(\/|$)/,
  /^\/api\/generate-python-workflow(\/|$)/,
  /^\/api\/jupyter(\/|$)/,
  /^\/api\/workflows\/[^/]+\/execute(\/|$)/,
  // Raw SQL and destructive seeding run with the app's full database rights
  /^\/api\/unified-analytics\/(query|seed)(\/|$)/
];

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

function isAdminOnly(pathname: string): boolean {
  return pathVariants(pathname).some((path) => ADMIN_ONLY_PATTERNS.some((pattern) => pattern.test(path)));
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
  if (user.role !== 'admin' && isAdminOnly(pathname)) {
    return { action: 'forbidden' };
  }
  if (user.role === 'viewer' && !READ_METHODS.has(verb) && !isPublic(pathname)) {
    return { action: 'forbidden' };
  }
  return { action: 'allow' };
}
