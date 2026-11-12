import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const SCRIPT = resolve(process.cwd(), 'scripts', 'jupyter-env.sh');
const PROBE = 'source "$1"; printf "%s\\n" "$JUPYTER_CONFIG_DIR" "$JUPYTER_TOKEN" "$JUPYTER_ALLOW_ORIGIN" "$JUPYTER_URL" "${JUPYTER_LAB_CMD[*]}"';

describe('scripts/jupyter-env.sh', () => {
	let project: string;
	beforeEach(() => {
		project = mkdtempSync(join(tmpdir(), 'jupyter-env-'));
	});
	afterEach(() => rmSync(project, { recursive: true, force: true }));

	const source = (env: Record<string, string> = {}) =>
		run('bash', ['-c', PROBE, 'probe', SCRIPT], { cwd: project, env: { PATH: process.env.PATH ?? '', ...env } });

	const bootstrap = () => {
		mkdirSync(join(project, '.jupyter'));
		writeFileSync(join(project, '.jupyter', 'jupyter_lab_config.py'), '# test config\n');
	};

	it('asks for the bootstrap, like the server does, when the project-local config is missing', async () => {
		await expect(source()).rejects.toMatchObject({ stderr: expect.stringContaining('jupyter:bootstrap') });
	});

	it('uses an absolute config folder, a random token and the dev origin by default', async () => {
		bootstrap();
		const [configDir, token, origin, url, command] = (await source()).stdout.trim().split('\n');
		expect(configDir.endsWith('/.jupyter')).toBe(true);
		expect(configDir.startsWith('/')).toBe(true);
		expect(token).toMatch(/^[0-9a-f]{48}$/);
		expect(origin).toBe('http://localhost:5173');
		expect(url).toBe('http://localhost:8888');
		expect(command).toContain('--ServerApp.ip=127.0.0.1');
		expect(command).toContain('--ServerApp.port_retries=0');
		expect(command).not.toContain(token);
	});

	it('keeps a token and origin the caller chose', async () => {
		bootstrap();
		const [, token, origin] = (await source({ JUPYTER_TOKEN: 'mine', JUPYTER_ALLOW_ORIGIN: 'https://app.example.com' })).stdout.trim().split('\n');
		expect(token).toBe('mine');
		expect(origin).toBe('https://app.example.com');
	});
});
