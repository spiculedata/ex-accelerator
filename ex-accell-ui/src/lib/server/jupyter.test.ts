import { describe, expect, it } from 'vitest';
import { buildJupyterLaunch, resolveExternalJupyter } from './jupyter';

describe('buildJupyterLaunch', () => {
	const launch = buildJupyterLaunch('http://localhost:5173', () => 'tok123');

	it('binds to loopback and never allows root', () => {
		expect(launch.args).toContain('--ServerApp.ip=127.0.0.1');
		expect(launch.args).not.toContain('--allow-root');
	});

	it('uses a per-launch token passed through the environment, not the command line', () => {
		expect(launch.env.JUPYTER_TOKEN).toBe('tok123');
		expect(launch.args.join(' ')).not.toContain('tok123');
		expect(launch.url).toBe('http://localhost:8888/?token=tok123');
	});

	it('restricts origin and framing to the app origin', () => {
		expect(launch.env.JUPYTER_ALLOW_ORIGIN).toBe('http://localhost:5173');
	});

	it('generates distinct random tokens by default', () => {
		const a = buildJupyterLaunch('http://localhost:5173');
		const b = buildJupyterLaunch('http://localhost:5173');
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
