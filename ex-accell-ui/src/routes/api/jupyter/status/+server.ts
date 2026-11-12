import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jupyterStatus } from '$lib/server/jupyterRuntime';

/** Reports whether Jupyter is up (and its link when it is). Never starts anything, so it is safe to poll. */
export const GET: RequestHandler = async () => {
	try {
		return json({ success: true, data: await jupyterStatus() }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('Error checking JupyterLab:', error);
		return json({ success: false, data: null, error: 'Could not check JupyterLab.' }, { status: 503 });
	}
};
