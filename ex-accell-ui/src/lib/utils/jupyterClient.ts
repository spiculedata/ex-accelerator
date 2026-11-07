export interface JupyterConnection {
	baseUrl: string;
	token: string;
}

/** Reads the `/api/jupyter/start` envelope; null when it failed or carries no token. */
export function parseJupyterStart(body: unknown): JupyterConnection | null {
	const envelope = body as { success?: boolean; data?: { url?: string; baseUrl?: string } } | null;
	const data = envelope?.data;
	if (!envelope?.success || !data?.url || !data.baseUrl) return null;
	try {
		const token = new URL(data.url).searchParams.get('token');
		return token ? { baseUrl: data.baseUrl, token } : null;
	} catch {
		return null;
	}
}

/** A JupyterLab link for `path` carrying the access token; empty until a connection exists. */
export function jupyterLink(connection: JupyterConnection | null, path: string): string {
	if (!connection) return '';
	const link = new URL(path, `${connection.baseUrl}/`);
	link.searchParams.set('token', connection.token);
	return link.toString();
}

/** Starts (or reuses) JupyterLab through the admin-only endpoint and returns how to reach it. */
export async function connectJupyter(onError?: (message: string) => void): Promise<JupyterConnection | null> {
	try {
		const response = await fetch('/api/jupyter/start', { method: 'POST' });
		const body = await response.json().catch(() => null);
		if (response.ok) return parseJupyterStart(body);
		onError?.(response.status === 403 || response.status === 401 ? 'Only administrators can start Jupyter Lab.' : (body?.error ?? 'Could not start Jupyter Lab.'));
		return null;
	} catch {
		onError?.('Could not reach the server.');
		return null;
	}
}
