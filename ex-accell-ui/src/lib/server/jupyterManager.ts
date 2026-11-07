import type { ChildProcess, SpawnOptions } from 'child_process';
import { buildJupyterLaunch, resolveExternalJupyter, type JupyterLaunch } from './jupyter';

export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface JupyterAccess {
	url: string;
	baseUrl: string;
	message: string;
}

interface ManagerOptions {
	spawn: SpawnFn;
	env: Record<string, string | undefined>;
	cwd: string;
}

/** Keeps track of the one JupyterLab this server started so repeat requests reuse it and its token. */
export function createJupyterManager({ spawn, env, cwd }: ManagerOptions) {
	let running: { child: ChildProcess; launch: JupyterLaunch } | null = null;

	return function ensureJupyter(appOrigin: string): JupyterAccess {
		const external = resolveExternalJupyter(env);
		if (external) return { ...external, message: 'Using the configured JupyterLab' };

		if (running) {
			return { url: running.launch.url, baseUrl: running.launch.baseUrl, message: 'JupyterLab is already running' };
		}

		const launch = buildJupyterLaunch(appOrigin);
		const child = spawn('poetry', ['run', 'jupyter', ...launch.args], {
			cwd,
			env: { ...env, ...launch.env },
			detached: true,
			stdio: 'ignore'
		});
		child.unref();
		const forget = () => {
			if (running?.child === child) running = null;
		};
		child.on('error', (error: Error) => {
			console.error('Failed to start JupyterLab:', error);
			forget();
		});
		child.on('exit', (code: number | null) => {
			console.log(`JupyterLab process exited with code ${code}`);
			forget();
		});
		running = { child, launch };
		return { url: launch.url, baseUrl: launch.baseUrl, message: 'JupyterLab starting...' };
	};
}
