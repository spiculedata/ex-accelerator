// Which workspace the page in front of the visitor belongs to, so the header can name it.

const WHOLE_NUMBER = /^\d+$/;

export function workspaceIdFromRoute(routeId: string | null, params: Record<string, string>, search: URLSearchParams): string | null {
  const raw = routeId?.startsWith('/workspaces/') ? params.id : search.get('workspace');
  return raw && WHOLE_NUMBER.test(raw) ? raw : null;
}
