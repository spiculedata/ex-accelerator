import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import { createJupyterManager } from '$lib/server/jupyterManager';

const ensureJupyter = createJupyterManager({ spawn, env: process.env, cwd: process.cwd() });

export const POST: RequestHandler = async ({ url }) => {
	try {
		const { message, ...data } = ensureJupyter(url.origin);
		return json({ success: true, message, data });
	} catch (error) {
		console.error('Error starting JupyterLab:', error);
		return json({ success: false, data: null, error: 'Failed to start JupyterLab' }, { status: 500 });
	}
};
