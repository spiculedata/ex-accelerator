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

export type JupyterObservation = 'running' | 'starting' | 'stopped' | 'error';

export interface JupyterPoll {
	phase: 'running' | 'starting' | 'stopped';
	/** Consecutive polls that disagreed with a running Jupyter */
	misses: number;
}

export const initialJupyterPoll: JupyterPoll = { phase: 'stopped', misses: 0 };

// One dropped request (a slow kernel, a brief network blip) should not tear down an open notebook
const MISSES_BEFORE_STOPPED = 2;

/** Folds one status check into the page state. A running Jupyter survives a single failed or "stopped" poll. */
export function nextJupyterPoll(current: JupyterPoll, observed: JupyterObservation): JupyterPoll {
	if (observed === 'running' || observed === 'starting') return { phase: observed, misses: 0 };
	if (current.phase === 'running' && current.misses + 1 < MISSES_BEFORE_STOPPED) {
		return { phase: 'running', misses: current.misses + 1 };
	}
	return { phase: 'stopped', misses: current.misses + 1 };
}

/** Reads the `/api/jupyter/status` envelope. Anything unexpected counts as an error, never as running. */
export function parseJupyterStatus(body: unknown): { observed: JupyterObservation; connection: JupyterConnection | null } {
	const failure = { observed: 'error' as const, connection: null };
	const envelope = body as { success?: boolean; data?: { state?: string; url?: string; baseUrl?: string } } | null;
	if (!envelope?.success || !envelope.data) return failure;
	const { state } = envelope.data;
	if (state === 'starting' || state === 'stopped') return { observed: state, connection: null };
	if (state !== 'running') return failure;
	const connection = parseJupyterStart(body);
	return connection ? { observed: 'running', connection } : failure;
}

/** Asks the server whether Jupyter is up. Read-only: it never launches anything. */
export async function fetchJupyterStatus(): Promise<{ observed: JupyterObservation; connection: JupyterConnection | null }> {
	try {
		const response = await fetch('/api/jupyter/status');
		if (!response.ok) return { observed: 'error', connection: null };
		return parseJupyterStatus(await response.json().catch(() => null));
	} catch {
		return { observed: 'error', connection: null };
	}
}

/**
 * Opens a blank tab for the launch. Must run inside the click so popup blockers allow it. Returns null when the
 * browser blocked it, so the caller can offer a link instead.
 */
export function openStartingTab(): Window | null {
	const tab = window.open('', '_blank');
	if (!tab) return null;
	tab.opener = null;
	tab.document.title = 'Starting JupyterLab…';
	tab.document.body.textContent = 'Starting JupyterLab… this tab opens it as soon as it is ready.';
	return tab;
}
