import type { ChildProcess, SpawnOptions } from 'child_process';
import { buildJupyterLaunch, resolveExternalJupyter } from './jupyter';

export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface JupyterAccess {
	url: string;
	baseUrl: string;
	message: string;
}

/** What survives a server restart: Jupyter is detached, so its token must be rediscoverable. */
export interface SavedLaunch {
	pid: number;
	url: string;
	baseUrl: string;
}

export interface LaunchStore {
	read(): SavedLaunch | null;
	write(launch: SavedLaunch): void;
	clear(): void;
}

interface ManagerOptions {
	spawn: SpawnFn;
	env: Record<string, string | undefined>;
	cwd: string;
	store: LaunchStore;
	isAlive: (pid: number) => boolean;
	isReady: (baseUrl: string, url: string) => Promise<boolean>;
	readyTimeoutMs?: number;
	pollMs?: number;
}

// Jupyter and its kernels get only what they need, not the app's secrets (SESSION_SECRET, ADMIN_PASSWORD)
const ENV_ALLOWLIST = /^(PATH|HOME|USER|LOGNAME|SHELL|LANG|LC_.*|TMPDIR|VIRTUAL_ENV|POETRY_.*|PYTHON.*|DATABASE_URL|PG[A-Z]+|OLLAMA_HOST|JUPYTER_.*)$/;

export function jupyterEnvironment(
	source: Record<string, string | undefined>,
	overrides: Record<string, string>
): Record<string, string> {
	const kept = Object.entries(source).filter(([key, value]) => value !== undefined && ENV_ALLOWLIST.test(key));
	return { ...(Object.fromEntries(kept) as Record<string, string>), ...overrides };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Keeps track of the one JupyterLab this app started so later requests (even after a restart) reuse it. */
export function createJupyterManager(options: ManagerOptions) {
	const { spawn, env, cwd, store, isAlive, isReady, readyTimeoutMs = 20_000, pollMs = 500 } = options;

	async function waitUntilReady(baseUrl: string, url: string): Promise<boolean> {
		const deadline = Date.now() + readyTimeoutMs;
		while (Date.now() < deadline) {
			if (await isReady(baseUrl, url)) return true;
			await sleep(pollMs);
		}
		return false;
	}

	return async function ensureJupyter(appOrigin: string): Promise<JupyterAccess> {
		const external = resolveExternalJupyter(env);
		if (external) return { ...external, message: 'Using the configured JupyterLab' };

		const saved = store.read();
		if (saved && isAlive(saved.pid)) {
			return { url: saved.url, baseUrl: saved.baseUrl, message: 'JupyterLab is already running' };
		}
		store.clear();

		const launch = buildJupyterLaunch(env.JUPYTER_ALLOW_ORIGIN || appOrigin);
		const child = spawn('poetry', ['run', 'jupyter', ...launch.args], {
			cwd,
			env: jupyterEnvironment(env, launch.env),
			detached: true,
			stdio: 'ignore'
		});
		child.unref();

		let failure: Error | null = null;
		child.on('error', (error: Error) => {
			console.error('Failed to start JupyterLab:', error);
			failure = error;
			store.clear();
		});
		child.on('exit', (code: number | null) => {
			console.log(`JupyterLab process exited with code ${code}`);
			store.clear();
		});

		if (child.pid !== undefined) store.write({ pid: child.pid, url: launch.url, baseUrl: launch.baseUrl });

		const ready = await waitUntilReady(launch.baseUrl, launch.url);
		if (failure || !ready) {
			store.clear();
			throw new Error(failure ? 'JupyterLab could not be launched (is Poetry installed?)' : 'JupyterLab did not become ready in time');
		}
		return { url: launch.url, baseUrl: launch.baseUrl, message: 'JupyterLab is running' };
	};
}
