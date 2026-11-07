import { mkdtempSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileLaunchStore } from './jupyterRuntime';

describe('fileLaunchStore', () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'jupyter-store-'));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it('round-trips a launch and keeps the file private to the user', () => {
		const store = fileLaunchStore(join(dir, 'nested', 'launch.json'));
		const launch = { pid: 12, url: 'http://localhost:8888/?token=t', baseUrl: 'http://localhost:8888' };
		store.write(launch);
		expect(store.read()).toEqual(launch);
		expect(statSync(join(dir, 'nested', 'launch.json')).mode & 0o777).toBe(0o600);
	});

	it('treats missing or corrupt files as no launch', () => {
		const path = join(dir, 'launch.json');
		const store = fileLaunchStore(path);
		expect(store.read()).toBeNull();
		writeFileSync(path, '{not json');
		expect(store.read()).toBeNull();
	});

	it('clears the record', () => {
		const store = fileLaunchStore(join(dir, 'launch.json'));
		store.write({ pid: 1, url: 'u', baseUrl: 'b' });
		store.clear();
		expect(store.read()).toBeNull();
	});
});
