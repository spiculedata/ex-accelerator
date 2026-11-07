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
 * access limited to the app's own origin.
 */
export function buildJupyterLaunch(
	appOrigin: string,
	generateToken: () => string = newToken
): JupyterLaunch {
	const token = generateToken();
	return {
		args: ['lab', `--port=${JUPYTER_PORT}`, '--ServerApp.ip=127.0.0.1', '--ServerApp.port_retries=0', '--no-browser'],
		env: {
			JUPYTER_TOKEN: token,
			JUPYTER_ALLOW_ORIGIN: appOrigin,
			JUPYTER_CONFIG_DIR: '.jupyter'
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
