import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn, type ChildProcess } from 'node:child_process';
import { buildJupyterLaunch, resolveExternalJupyter, type JupyterLaunch } from '$lib/server/jupyter';

// The JupyterLab this process started, and the launch settings (token) it was started with
let jupyterProcess: ChildProcess | null = null;
let currentLaunch: JupyterLaunch | null = null;

const respond = (message: string, launch: { url: string }, baseUrl: string) =>
	json({ success: true, message, data: { url: launch.url, baseUrl } });

export const POST: RequestHandler = async ({ url }) => {
	const external = resolveExternalJupyter(process.env);
	if (external) return respond('Using the configured JupyterLab', external, external.baseUrl);

	if (jupyterProcess !== null && currentLaunch !== null) {
		return respond('JupyterLab is already running', currentLaunch, 'http://localhost:8888');
	}

	try {
		const launch = buildJupyterLaunch(url.origin);
		const child = spawn('poetry', ['run', 'jupyter', ...launch.args], {
			cwd: process.cwd(),
			env: { ...process.env, ...launch.env },
			detached: true,
			stdio: 'ignore'
		});
		child.unref();
		child.on('error', (error: Error) => {
			console.error('Failed to start JupyterLab:', error);
			jupyterProcess = null;
			currentLaunch = null;
		});
		child.on('exit', (code: number | null) => {
			console.log(`JupyterLab process exited with code ${code}`);
			jupyterProcess = null;
			currentLaunch = null;
		});
		jupyterProcess = child;
		currentLaunch = launch;
		return respond('JupyterLab starting...', launch, 'http://localhost:8888');
	} catch (error) {
		console.error('Error starting JupyterLab:', error);
		return json({ success: false, data: null, error: 'Failed to start JupyterLab' }, { status: 500 });
	}
};
