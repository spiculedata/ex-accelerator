import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureJupyter } from '$lib/server/jupyterRuntime';

export const POST: RequestHandler = async ({ url }) => {
	try {
		const { message, ...data } = await ensureJupyter(url.origin);
		return json({ success: true, message, data });
	} catch (error) {
		console.error('Error starting JupyterLab:', error);
		return json({ success: false, data: null, error: 'Failed to start JupyterLab' }, { status: 503 });
	}
};
