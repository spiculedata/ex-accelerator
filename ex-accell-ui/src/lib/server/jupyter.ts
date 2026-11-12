import { randomBytes } from 'node:crypto';

const JUPYTER_PORT = 8888;
const TOKEN_BYTES = 24;

export interface JupyterLaunch {
	args: string[];
	env: { JUPYTER_TOKEN: string; JUPYTER_ALLOW_ORIGIN: string; JUPYTER_CONFIG_DIR: string };
	url: string;
	baseUrl: string;
}

export interface ExternalJupyter {
	url: string;
	baseUrl: string;
}

const newToken = (): string => randomBytes(TOKEN_BYTES).toString('hex');

/**
 * Launch settings for a JupyterLab started by the app: loopback only, a fresh random token
 * (handed over via the environment so it never shows in the process list) and cross-origin
 * access limited to the app's own origin. `configDir` is the project-local Jupyter config folder;
 * pass an absolute path so the launch does not depend on the working directory.
 */
export function buildJupyterLaunch(
	appOrigin: string,
	configDir: string,
	generateToken: () => string = newToken
): JupyterLaunch {
	const token = generateToken();
	return {
		args: ['lab', `--port=${JUPYTER_PORT}`, '--ServerApp.ip=127.0.0.1', '--ServerApp.port_retries=0', '--no-browser'],
		env: {
			JUPYTER_TOKEN: token,
			JUPYTER_ALLOW_ORIGIN: appOrigin,
			JUPYTER_CONFIG_DIR: configDir
		},
		baseUrl: `http://localhost:${JUPYTER_PORT}`,
		url: `http://localhost:${JUPYTER_PORT}/?token=${token}`
	};
}

/** A Jupyter run elsewhere (for example the compose service), configured with JUPYTER_URL and JUPYTER_TOKEN. */
export function resolveExternalJupyter(env: Record<string, string | undefined>): ExternalJupyter | null {
	const { JUPYTER_URL: rawUrl, JUPYTER_TOKEN: token } = env;
	if (!rawUrl || !token) return null;
	const baseUrl = rawUrl.replace(/\/+$/, '');
	return { baseUrl, url: `${baseUrl}/?token=${encodeURIComponent(token)}` };
}

/**
 * The request that checks a Jupyter is up and accepts our token. The token goes in the
 * Authorization header, never the query string, so it stays out of access logs and proxies.
 */
export function jupyterReadinessRequest(baseUrl: string, token: string): { url: string; headers: Record<string, string> } {
	return { url: `${baseUrl}/api`, headers: { Authorization: `token ${token}` } };
}

/** Reads the token out of a launch URL such as `http://localhost:8888/?token=abc`; empty when absent. */
export function tokenFromJupyterUrl(url: string): string {
	try {
		return new URL(url).searchParams.get('token') ?? '';
	} catch {
		return '';
	}
}
