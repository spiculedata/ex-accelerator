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
	/** Stops a launched Jupyter (and its process group) that never became usable */
	kill: (pid: number) => void;
	/** The project-local config written by `npm run jupyter:bootstrap` */
	hasConfig: () => boolean;
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
	const { spawn, env, cwd, store, isAlive, isReady, kill, hasConfig, readyTimeoutMs = 20_000, pollMs = 500 } = options;
	let inFlight: Promise<JupyterAccess> | null = null;

	async function launchJupyter(appOrigin: string): Promise<JupyterAccess> {
		const saved = store.read();
		if (saved && isAlive(saved.pid) && (await isReady(saved.baseUrl, saved.url))) {
			return { url: saved.url, baseUrl: saved.baseUrl, message: 'JupyterLab is already running' };
		}
		// A recorded process that is alive but not answering still holds the port (or is a recycled pid's stranger)
		if (saved && isAlive(saved.pid)) kill(saved.pid);
		store.clear();

		if (!hasConfig()) throw new Error('Jupyter is not set up yet: run `npm run jupyter:bootstrap` first');

		const launch = buildJupyterLaunch(env.JUPYTER_ALLOW_ORIGIN || appOrigin);
		const child = spawn('poetry', ['run', 'jupyter', ...launch.args], {
			cwd,
			env: jupyterEnvironment(env, launch.env),
			detached: true,
			stdio: 'ignore'
		});
		child.unref();

		let failure: Error | null = null;
		let exitedEarly = false;
		// A stale child must never wipe the record of a newer launch
		const forgetIfMine = () => {
			if (store.read()?.pid === child.pid) store.clear();
		};
		child.on('error', (error: Error) => {
			console.error('Failed to start JupyterLab:', error);
			failure = error;
			forgetIfMine();
		});
		child.on('exit', (code: number | null) => {
			console.log(`JupyterLab process exited with code ${code}`);
			exitedEarly = true;
			forgetIfMine();
		});

		if (child.pid !== undefined) store.write({ pid: child.pid, url: launch.url, baseUrl: launch.baseUrl });

		const deadline = Date.now() + readyTimeoutMs;
		let ready = false;
		while (!failure && !exitedEarly && !ready && Date.now() < deadline) {
			ready = await isReady(launch.baseUrl, launch.url);
			if (!ready) await sleep(pollMs);
		}
		if (ready) return { url: launch.url, baseUrl: launch.baseUrl, message: 'JupyterLab is running' };

		if (child.pid !== undefined) kill(child.pid);
		forgetIfMine();
		if (failure) throw new Error('JupyterLab could not be launched (is Poetry installed?)');
		if (exitedEarly) throw new Error('JupyterLab exited straight away; port 8888 may already be in use by another Jupyter');
		throw new Error('JupyterLab did not become ready in time');
	}

	return async function ensureJupyter(appOrigin: string): Promise<JupyterAccess> {
		const external = resolveExternalJupyter(env);
		if (external) return { ...external, message: 'Using the configured JupyterLab' };

		// Concurrent callers (double click, two tabs) share one launch
		inFlight ??= launchJupyter(appOrigin).finally(() => {
			inFlight = null;
		});
		return inFlight;
	};
}
