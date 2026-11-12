import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureJupyter } from '$lib/server/jupyterRuntime';
import { JupyterNotSetUpError } from '$lib/server/jupyterManager';

export const POST: RequestHandler = async ({ url }) => {
	try {
		const { message, ...data } = await ensureJupyter(url.origin);
		return json({ success: true, message, data });
	} catch (error) {
		console.error('Error starting JupyterLab:', error);
		// The manager's messages are written for the admin and contain no secrets
		const message = error instanceof Error ? error.message : 'Failed to start JupyterLab';
		// Not bootstrapped is a conflict with the current setup (fix it and retry), not an outage
		const status = error instanceof JupyterNotSetUpError ? 409 : 503;
		return json({ success: false, data: null, error: message }, { status });
	}
};
