import { describe, expect, it, vi } from 'vitest';
import { killProcessGroup } from './jupyterKill';

describe('killProcessGroup', () => {
	it('signals the whole process group on POSIX', () => {
		const signal = vi.fn();
		const run = vi.fn();
		killProcessGroup(42, { platform: 'linux', signal, run });
		expect(signal).toHaveBeenCalledWith(-42, 'SIGTERM');
		expect(run).not.toHaveBeenCalled();
	});

	it('ignores a process that is already gone', () => {
		const signal = vi.fn(() => {
			throw new Error('ESRCH');
		});
		expect(() => killProcessGroup(42, { platform: 'darwin', signal })).not.toThrow();
	});

	it('uses taskkill with an argument array on Windows, where process groups do not exist', () => {
		const signal = vi.fn();
		const run = vi.fn();
		killProcessGroup(42, { platform: 'win32', signal, run });
		expect(run).toHaveBeenCalledWith('taskkill', ['/pid', '42', '/T', '/F']);
		expect(signal).not.toHaveBeenCalled();
	});

	it('refuses pids that could address a group or init', () => {
		const signal = vi.fn();
		const run = vi.fn();
		for (const pid of [0, 1, -5, 1.5, Number.NaN]) killProcessGroup(pid, { platform: 'linux', signal, run });
		expect(signal).not.toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
	});
});
