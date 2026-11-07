import { describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import { createJupyterManager, type SpawnFn } from './jupyterManager';

function fakeSpawn() {
	const handlers: Record<string, (...args: unknown[]) => void> = {};
	const child = {
		unref: vi.fn(),
		on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
			handlers[event] = handler;
		})
	} as unknown as ChildProcess;
	const spawn = vi.fn(() => child) as unknown as SpawnFn & ReturnType<typeof vi.fn>;
	return { spawn, handlers };
}

const ORIGIN = 'http://localhost:5173';

describe('createJupyterManager', () => {
	it('uses the configured Jupyter without spawning', () => {
		const { spawn } = fakeSpawn();
		const ensure = createJupyterManager({ spawn, env: { JUPYTER_URL: 'http://j:8888', JUPYTER_TOKEN: 'abc' }, cwd: '.' });
		expect(ensure(ORIGIN).url).toBe('http://j:8888/?token=abc');
		expect(spawn).not.toHaveBeenCalled();
	});

	it('spawns with an argument array and the token only in the environment', () => {
		const { spawn } = fakeSpawn();
		const access = createJupyterManager({ spawn, env: {}, cwd: '.' })(ORIGIN);
		const [command, args, options] = spawn.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }];
		expect(command).toBe('poetry');
		expect(args).toContain('--ServerApp.port_retries=0');
		expect(args).not.toContain('--allow-root');
		expect(args.join(' ')).not.toContain(options.env.JUPYTER_TOKEN);
		expect(access.url).toContain(options.env.JUPYTER_TOKEN);
	});

	it('reuses the running process and its token', () => {
		const { spawn } = fakeSpawn();
		const ensure = createJupyterManager({ spawn, env: {}, cwd: '.' });
		const first = ensure(ORIGIN);
		const second = ensure(ORIGIN);
		expect(spawn).toHaveBeenCalledTimes(1);
		expect(second.url).toBe(first.url);
	});

	it('starts again after the process exits', () => {
		const { spawn, handlers } = fakeSpawn();
		const ensure = createJupyterManager({ spawn, env: {}, cwd: '.' });
		ensure(ORIGIN);
		handlers.exit(0);
		ensure(ORIGIN);
		expect(spawn).toHaveBeenCalledTimes(2);
	});
});
