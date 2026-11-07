export interface JupyterConnection {
	baseUrl: string;
	token: string;
}

/** Reads the `/api/jupyter/start` envelope; null when it failed or carries no token. */
export function parseJupyterStart(body: unknown): JupyterConnection | null {
	const data = (body as { success?: boolean; data?: { url?: string; baseUrl?: string } } | null)?.data;
	if (!(body as { success?: boolean } | null)?.success || !data?.url || !data.baseUrl) return null;
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
	return `${connection.baseUrl}${path}?token=${encodeURIComponent(connection.token)}`;
}

/** Starts (or reuses) JupyterLab through the admin-only endpoint and returns how to reach it. */
export async function connectJupyter(): Promise<JupyterConnection | null> {
	try {
		const response = await fetch('/api/jupyter/start', { method: 'POST' });
		return response.ok ? parseJupyterStart(await response.json()) : null;
	} catch {
		return null;
	}
}
