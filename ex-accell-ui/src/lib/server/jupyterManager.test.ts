import { describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import { createJupyterManager, jupyterEnvironment, type LaunchStore, type SavedLaunch, type SpawnFn } from './jupyterManager';

function setup(overrides: { env?: Record<string, string>; ready?: boolean; saved?: SavedLaunch | null; alive?: boolean; config?: boolean; readyTimeoutMs?: number } = {}) {
	const handlers: Record<string, (...args: unknown[]) => void> = {};
	const child = {
		pid: 4242,
		unref: vi.fn(),
		on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
			handlers[event] = handler;
		})
	} as unknown as ChildProcess;
	const spawn = vi.fn(() => child) as unknown as SpawnFn & ReturnType<typeof vi.fn>;
	let saved: SavedLaunch | null = overrides.saved ?? null;
	const store: LaunchStore = {
		read: () => saved,
		write: (launch) => {
			saved = launch;
		},
		clear: () => {
			saved = null;
		}
	};
	const kill = vi.fn();
	let readyCalls = 0;
	const ensure = createJupyterManager({
		spawn,
		env: overrides.env ?? {},
		cwd: '.',
		store,
		isAlive: () => overrides.alive ?? true,
		isReady: async () => {
			readyCalls++;
			return overrides.ready ?? true;
		},
		kill,
		hasConfig: () => overrides.config ?? true,
		readyTimeoutMs: overrides.readyTimeoutMs ?? 30,
		pollMs: 5
	});
	return { ensure, spawn, handlers, store, kill, isReadyCalls: () => readyCalls };
}

const ORIGIN = 'http://localhost:5173';

describe('createJupyterManager', () => {
	it('uses the configured Jupyter without spawning', async () => {
		const { ensure, spawn } = setup({ env: { JUPYTER_URL: 'http://j:8888', JUPYTER_TOKEN: 'abc' } });
		expect((await ensure(ORIGIN)).url).toBe('http://j:8888/?token=abc');
		expect(spawn).not.toHaveBeenCalled();
	});

	it('spawns with an argument array and the token only in the environment', async () => {
		const { ensure, spawn } = setup();
		const access = await ensure(ORIGIN);
		const [command, args, options] = spawn.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }];
		expect(command).toBe('poetry');
		expect(args).toContain('--ServerApp.port_retries=0');
		expect(args).not.toContain('--allow-root');
		expect(args.join(' ')).not.toContain(options.env.JUPYTER_TOKEN);
		expect(access.url).toContain(options.env.JUPYTER_TOKEN);
	});

	it('reuses the saved launch while its process is alive, even after a server restart', async () => {
		const saved = { pid: 7, url: 'http://localhost:8888/?token=old', baseUrl: 'http://localhost:8888' };
		const { ensure, spawn } = setup({ saved });
		expect((await ensure(ORIGIN)).url).toBe(saved.url);
		expect(spawn).not.toHaveBeenCalled();
	});

	it('starts a new Jupyter when the saved process is gone', async () => {
		const saved = { pid: 7, url: 'http://localhost:8888/?token=old', baseUrl: 'http://localhost:8888' };
		const { ensure, spawn } = setup({ saved, alive: false });
		const access = await ensure(ORIGIN);
		expect(spawn).toHaveBeenCalledTimes(1);
		expect(access.url).not.toContain('token=old');
	});

	it('fails, forgets the launch and kills the process when Jupyter never becomes ready', async () => {
		const { ensure, store, kill } = setup({ ready: false });
		await expect(ensure(ORIGIN)).rejects.toThrow(/did not become ready/);
		expect(store.read()).toBeNull();
		expect(kill).toHaveBeenCalledWith(4242);
	});

	it('does not reuse a saved launch whose pid is alive but not answering', async () => {
		const saved = { pid: 7, url: 'http://localhost:8888/?token=old', baseUrl: 'http://localhost:8888' };
		const { ensure, spawn, kill } = setup({ saved, ready: false });
		await expect(ensure(ORIGIN)).rejects.toThrow();
		expect(kill).toHaveBeenCalledWith(7);
		expect(spawn).toHaveBeenCalledTimes(1);
	});

	it('shares one launch between concurrent requests', async () => {
		const { ensure, spawn } = setup();
		const [a, b] = await Promise.all([ensure(ORIGIN), ensure(ORIGIN)]);
		expect(spawn).toHaveBeenCalledTimes(1);
		expect(a.url).toBe(b.url);
	});

	it('asks for the bootstrap when the project-local config is missing', async () => {
		const { ensure, spawn } = setup({ config: false });
		await expect(ensure(ORIGIN)).rejects.toThrow(/jupyter:bootstrap/);
		expect(spawn).not.toHaveBeenCalled();
	});

	it('does not let a stale child clear a newer launch', async () => {
		const { ensure, handlers, store } = setup();
		await ensure(ORIGIN);
		store.write({ pid: 9999, url: 'http://localhost:8888/?token=new', baseUrl: 'http://localhost:8888' });
		handlers.exit(1);
		expect(store.read()?.pid).toBe(9999);
	});

	it('reports a launch error such as a missing Poetry', async () => {
		const { ensure, handlers } = setup({ ready: false });
		const pending = ensure(ORIGIN);
		await Promise.resolve();
		handlers.error(new Error('spawn poetry ENOENT'));
		await expect(pending).rejects.toThrow(/Poetry/);
	});

	it('fails fast, naming the port, when Jupyter exits before it is ready', async () => {
		const { ensure, handlers, isReadyCalls } = setup({ ready: false, readyTimeoutMs: 5000 });
		const started = Date.now();
		const pending = ensure(ORIGIN);
		await Promise.resolve();
		handlers.exit(1);
		await expect(pending).rejects.toThrow(/8888/);
		expect(Date.now() - started).toBeLessThan(1000);
		expect(isReadyCalls()).toBeLessThan(5);
	});

	it('forgets the launch when the process exits', async () => {
		const { ensure, handlers, store } = setup();
		await ensure(ORIGIN);
		handlers.exit(0);
		expect(store.read()).toBeNull();
	});

	it('honours an explicit JUPYTER_ALLOW_ORIGIN', async () => {
		const { ensure, spawn } = setup({ env: { JUPYTER_ALLOW_ORIGIN: 'https://app.example.com' } });
		await ensure(ORIGIN);
		const options = (spawn.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }])[2];
		expect(options.env.JUPYTER_ALLOW_ORIGIN).toBe('https://app.example.com');
	});
});

describe('jupyterEnvironment', () => {
	it('drops the app secrets but keeps what Jupyter needs', () => {
		const env = jupyterEnvironment(
			{ PATH: '/bin', HOME: '/h', SESSION_SECRET: 's', ADMIN_PASSWORD: 'p', DATABASE_URL: 'postgres://x', PGHOST: 'h' },
			{ JUPYTER_TOKEN: 't' }
		);
		expect(env).toEqual({ PATH: '/bin', HOME: '/h', DATABASE_URL: 'postgres://x', PGHOST: 'h', JUPYTER_TOKEN: 't' });
	});
});
