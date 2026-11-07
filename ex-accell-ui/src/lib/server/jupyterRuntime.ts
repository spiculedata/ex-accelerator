import { spawn } from 'child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { createJupyterManager, type LaunchStore, type SavedLaunch } from './jupyterManager';

const READY_PROBE_MS = 1500;

/** The launch (pid and tokenised URL) lives in the git-ignored .jupyter/ folder, readable by this user only. */
export function fileLaunchStore(path: string): LaunchStore {
	return {
		read() {
			try {
				const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<SavedLaunch>;
				return typeof parsed.pid === 'number' && parsed.url && parsed.baseUrl ? (parsed as SavedLaunch) : null;
			} catch {
				return null;
			}
		},
		write(launch) {
			mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
			writeFileSync(path, JSON.stringify(launch), { mode: 0o600 });
			chmodSync(path, 0o600);
		},
		clear() {
			rmSync(path, { force: true });
		}
	};
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function killProcessGroup(pid: number): void {
	try {
		process.kill(-pid, 'SIGTERM');
	} catch {
		// already gone
	}
}

async function isReady(baseUrl: string, url: string): Promise<boolean> {
	try {
		const token = new URL(url).searchParams.get('token') ?? '';
		const response = await fetch(`${baseUrl}/api?token=${encodeURIComponent(token)}`, {
			signal: AbortSignal.timeout(READY_PROBE_MS)
		});
		return response.ok;
	} catch {
		return false;
	}
}

export const ensureJupyter = createJupyterManager({
	spawn,
	env: process.env,
	cwd: process.cwd(),
	store: fileLaunchStore(join(process.cwd(), '.jupyter', 'launch.json')),
	isAlive,
	isReady,
	kill: killProcessGroup,
	hasConfig: () => existsSync(join(process.cwd(), '.jupyter', 'jupyter_lab_config.py'))
});
