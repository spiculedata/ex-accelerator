import type { ChildProcess, SpawnOptions } from 'child_process';
import { resolve } from 'node:path';
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

/** Raised when the one-time `npm run jupyter:bootstrap` has not run; a setup problem, not a server fault. */
export class JupyterNotSetUpError extends Error {
	constructor() {
		super('Jupyter is not set up yet: run `npm run jupyter:bootstrap` first');
		this.name = 'JupyterNotSetUpError';
	}
}

// Jupyter and its kernels get only what they need, not the app's secrets (SESSION_SECRET, ADMIN_PASSWORD).
// Beyond the basics that is the database and Ollama settings, plus the proxy, CA bundle and model-cache
// variables that notebooks need to download packages and models (NLTK, Hugging Face, torch, pip) behind
// a corporate proxy. Anything else is dropped; set it in the notebook or in .jupyter/ instead.
const ENV_ALLOWLIST = new RegExp(
	'^(' +
		[
			'PATH|HOME|USER|LOGNAME|SHELL|LANG|LC_.*|TMPDIR|VIRTUAL_ENV|POETRY_.*|PYTHON.*',
			'DATABASE_URL|PG[A-Z]+|OLLAMA_HOST|JUPYTER_.*',
			'(?:HTTP|HTTPS|ALL|NO)_PROXY|(?:http|https|all|no)_proxy',
			'SSL_CERT_FILE|SSL_CERT_DIR|REQUESTS_CA_BUNDLE|CURL_CA_BUNDLE|PIP_CERT',
			'XDG_CACHE_HOME|XDG_DATA_HOME|XDG_CONFIG_HOME|HF_(?:HOME|HUB_CACHE|ENDPOINT|HUB_OFFLINE)|TRANSFORMERS_(?:CACHE|OFFLINE)|TORCH_HOME|NLTK_DATA'
		].join('|') +
		')$'
);

// Even an allowed prefix (POETRY_*, PYTHON*) can carry credentials, e.g. POETRY_PYPI_TOKEN_X. Anything that
// looks like a secret is dropped; PGPASSWORD stays because notebooks need it to reach the database.
const SECRET_LOOKING = /(TOKEN|SECRET|PASSWORD|API_?KEY|HTTP_BASIC|CREDENTIAL)/i;
const SECRET_EXCEPTIONS = new Set(['PGPASSWORD']);

export function jupyterEnvironment(
	source: Record<string, string | undefined>,
	overrides: Record<string, string>
): Record<string, string> {
	const kept = Object.entries(source).filter(([key, value]) => value !== undefined && ENV_ALLOWLIST.test(key) && (SECRET_EXCEPTIONS.has(key) || !SECRET_LOOKING.test(key)));
	return { ...(Object.fromEntries(kept) as Record<string, string>), ...overrides };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the pages need to know without launching anything. */
export type JupyterStatus =
	| { state: 'running'; url: string; baseUrl: string }
	| { state: 'starting' }
	| { state: 'stopped' };

/** Keeps track of the one JupyterLab this app started so later requests (even after a restart) reuse it. */
export function createJupyterManager(options: ManagerOptions) {
	const { spawn, env, cwd, store, isAlive, isReady, kill, hasConfig, readyTimeoutMs = 20_000, pollMs = 500 } = options;
	let inFlight: Promise<JupyterAccess> | null = null;

	async function launchJupyter(appOrigin: string): Promise<JupyterAccess> {
		const saved = store.read();
		if (saved && isAlive(saved.pid) && (await isReady(saved.baseUrl, saved.url))) {
			return { url: saved.url, baseUrl: saved.baseUrl, message: 'JupyterLab is already running' };
		}
		// Never signal a recorded pid we cannot verify: it may have been recycled by an unrelated process.
		// If it really is a stuck Jupyter, the relaunch fails fast with a "port in use" message instead.
		store.clear();

		if (!hasConfig()) throw new JupyterNotSetUpError();

		const launch = buildJupyterLaunch(env.JUPYTER_ALLOW_ORIGIN || appOrigin, resolve(cwd, '.jupyter'));
		const child = spawn('poetry', ['run', 'jupyter', ...launch.args], {
			cwd,
			env: jupyterEnvironment(env, launch.env),
			detached: true,
			stdio: 'ignore'
		});
		child.unref();

		let failure: Error | null = null;
		let hasExited = false;
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
			hasExited = true;
			forgetIfMine();
		});

		if (child.pid !== undefined) store.write({ pid: child.pid, url: launch.url, baseUrl: launch.baseUrl });

		const deadline = Date.now() + readyTimeoutMs;
		let ready = false;
		while (!failure && !hasExited && !ready && Date.now() < deadline) {
			ready = await isReady(launch.baseUrl, launch.url);
			if (!ready) await sleep(pollMs);
		}
		if (ready) return { url: launch.url, baseUrl: launch.baseUrl, message: 'JupyterLab is running' };

		if (child.pid !== undefined) kill(child.pid);
		forgetIfMine();
		if (failure) throw new Error('JupyterLab could not be launched (is Poetry installed?)');
		if (hasExited) throw new Error('JupyterLab exited straight away; port 8888 may already be in use by another Jupyter');
		throw new Error('JupyterLab did not become ready in time');
	}

	/**
	 * Looks without touching: never spawns, kills or rewrites the saved launch. Pages call it on load and
	 * on a timer to find a Jupyter that is already running, so the launch controls only appear when needed.
	 */
	async function status(): Promise<JupyterStatus> {
		const external = resolveExternalJupyter(env);
		if (external) {
			return (await isReady(external.baseUrl, external.url)) ? { state: 'running', ...external } : { state: 'stopped' };
		}
		// A Jupyter that already answers is running even if another request is mid-launch, so an open
		// notebook is not torn down while a second tab clicks Start
		const saved = store.read();
		if (saved && isAlive(saved.pid) && (await isReady(saved.baseUrl, saved.url))) {
			return { state: 'running', url: saved.url, baseUrl: saved.baseUrl };
		}
		return inFlight ? { state: 'starting' } : { state: 'stopped' };
	}

	async function ensure(appOrigin: string): Promise<JupyterAccess> {
		const external = resolveExternalJupyter(env);
		if (external) return { ...external, message: 'Using the configured JupyterLab' };
		if (env.JUPYTER_URL) throw new Error('JUPYTER_URL is set but JUPYTER_TOKEN is empty: set JUPYTER_TOKEN in .env');

		// Concurrent callers (double click, two tabs) share one launch
		inFlight ??= launchJupyter(appOrigin).finally(() => {
			inFlight = null;
		});
		return inFlight;
	}

	return { ensure, status };
}
