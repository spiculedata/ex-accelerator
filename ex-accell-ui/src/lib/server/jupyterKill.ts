import { execFile } from 'node:child_process';

interface KillDeps {
	platform?: NodeJS.Platform;
	signal?: (pid: number, signal: NodeJS.Signals) => void;
	run?: (command: string, args: string[]) => void;
}

const defaultSignal = (pid: number, signal: NodeJS.Signals) => process.kill(pid, signal);
const defaultRun = (command: string, args: string[]) => {
	execFile(command, args, { windowsHide: true }, () => {
		// best effort: the process may already be gone
	});
};

/**
 * Stops a detached Jupyter and the kernels it started. POSIX signals the whole process group
 * (negative pid); Windows has no process groups, so `taskkill /T` stops the process tree instead.
 */
export function killProcessGroup(pid: number, deps: KillDeps = {}): void {
	const { platform = process.platform, signal = defaultSignal, run = defaultRun } = deps;
	if (platform === 'win32') {
		run('taskkill', ['/pid', String(pid), '/T', '/F']);
		return;
	}
	try {
		signal(-pid, 'SIGTERM');
	} catch {
		// already gone
	}
}
