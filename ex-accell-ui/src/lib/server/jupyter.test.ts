import { describe, expect, it } from 'vitest';
import { buildJupyterLaunch, jupyterReadinessRequest, resolveExternalJupyter, tokenFromJupyterUrl } from './jupyter';

describe('buildJupyterLaunch', () => {
	const launch = buildJupyterLaunch('http://localhost:5173', '/srv/app/.jupyter', () => 'tok123');

	it('binds to loopback and never allows root', () => {
		expect(launch.args).toContain('--ServerApp.ip=127.0.0.1');
		expect(launch.args).not.toContain('--allow-root');
	});

	it('uses a per-launch token passed through the environment, not the command line', () => {
		expect(launch.env.JUPYTER_TOKEN).toBe('tok123');
		expect(launch.args.join(' ')).not.toContain('tok123');
		expect(launch.url).toBe('http://localhost:8888/?token=tok123');
	});

	it('fails instead of moving to another port when 8888 is taken', () => {
		expect(launch.args).toContain('--ServerApp.port_retries=0');
		expect(launch.baseUrl).toBe('http://localhost:8888');
	});

	it('restricts origin and framing to the app origin', () => {
		expect(launch.env.JUPYTER_ALLOW_ORIGIN).toBe('http://localhost:5173');
	});

	it('passes the config folder it was given instead of a cwd-relative one', () => {
		expect(launch.env.JUPYTER_CONFIG_DIR).toBe('/srv/app/.jupyter');
	});

	it('generates distinct random tokens by default', () => {
		const a = buildJupyterLaunch('http://localhost:5173', '/srv/app/.jupyter');
		const b = buildJupyterLaunch('http://localhost:5173', '/srv/app/.jupyter');
		expect(a.env.JUPYTER_TOKEN).not.toBe(b.env.JUPYTER_TOKEN);
		expect(a.env.JUPYTER_TOKEN.length).toBeGreaterThanOrEqual(32);
	});
});

describe('resolveExternalJupyter', () => {
	it('is null unless both a URL and a token are configured', () => {
		expect(resolveExternalJupyter({})).toBeNull();
		expect(resolveExternalJupyter({ JUPYTER_URL: 'http://j:8888' })).toBeNull();
	});

	it('returns the configured URL with the token', () => {
		expect(resolveExternalJupyter({ JUPYTER_URL: 'http://j:8888/', JUPYTER_TOKEN: 'abc' })).toEqual({
			url: 'http://j:8888/?token=abc',
			baseUrl: 'http://j:8888'
		});
	});
});

describe('jupyterReadinessRequest', () => {
	it('sends the token in the Authorization header, not the URL', () => {
		const request = jupyterReadinessRequest('http://localhost:8888', 'tok123');
		expect(request.url).toBe('http://localhost:8888/api');
		expect(request.headers).toEqual({ Authorization: 'token tok123' });
	});
});

describe('tokenFromJupyterUrl', () => {
	it('reads the token from a launch URL', () => {
		expect(tokenFromJupyterUrl('http://localhost:8888/?token=abc')).toBe('abc');
	});

	it('is empty when there is no token or the URL is invalid', () => {
		expect(tokenFromJupyterUrl('http://localhost:8888/')).toBe('');
		expect(tokenFromJupyterUrl('not a url')).toBe('');
	});
});
